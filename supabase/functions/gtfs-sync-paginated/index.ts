import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_HOUR = 27;
const MAX_RETRIES = 12;

/**
 * Check if an error message indicates a retriable resource limit
 */
function isRetriableError(errText: string): boolean {
  const retriablePatterns = [
    "WORKER_LIMIT",
    "CPU Time exceeded",
    "CPU budget",
    "memory",
    "Resource temporarily unavailable",
  ];
  return retriablePatterns.some(p => errText.toLowerCase().includes(p.toLowerCase()));
}

/**
 * Paginated wrapper that auto-chains calls for shapes and stop-times.
 * For stop_times, iterates hours 0-27 sequentially for the given day.
 * Within each hour, paginates if needed.
 * 
 * Auto-retries retriable errors (WORKER_LIMIT, CPU exceeded) up to 5 times
 * with exponential backoff.
 *
 * Query params:
 *   - agency_id (required)
 *   - file_type: "shapes" | "stop_times" (required)
 *   - day_offset: 0–6 (only for stop_times)
 *   - start_page: resume page (default 0)
 *   - start_hour: resume hour (default 0, only for stop_times)
 *   - single_hour: if "true", only process start_hour (for per-hour retrigger)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const agencyId = url.searchParams.get("agency_id");
    const fileType = url.searchParams.get("file_type");
    const dayOffset = url.searchParams.get("day_offset") ?? "0";
    const startPage = parseInt(url.searchParams.get("start_page") ?? "0");
    const startHour = parseInt(url.searchParams.get("start_hour") ?? "0");
    const singleHour = url.searchParams.get("single_hour") === "true";

    if (!agencyId || !fileType) {
      return new Response(
        JSON.stringify({ error: "agency_id and file_type query params required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const functionMap: Record<string, string> = {
      shapes: "gtfs-sync-shapes",
      stop_times: "gtfs-sync-stop-times",
    };

    const functionName = functionMap[fileType];
    if (!functionName) {
      return new Response(
        JSON.stringify({ error: `Invalid file_type: ${fileType}. Must be 'shapes' or 'stop_times'` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const startTime = Date.now();
    const TIME_BUDGET_MS = 120_000;

    let totalRows = 0;
    let timedOut = false;

    if (fileType === "stop_times") {
      // Hour-by-hour iteration for stop_times
      let currentHour = startHour;
      let currentPage = startPage;
      // In single_hour mode, only process startHour (used for per-hour retrigger from admin)
      const maxHour = singleHour ? startHour : MAX_HOUR;

      while (currentHour <= maxHour) {
        if (Date.now() - startTime > TIME_BUDGET_MS) {
          console.log(`[${agencyId}] Time budget exceeded at hour=${currentHour} page=${currentPage}`);
          timedOut = true;
          // Mark the current in-progress hour as error so it's retriggerable from the admin UI
          if (!singleHour) {
            const ft = `stop_times_d${dayOffset}_h${currentHour}`;
            await supabase.from("gtfs_sync_status").upsert({
              agency_id: agencyId,
              file_type: ft,
              status: "error",
              error_msg: `Timed out at page ${currentPage} — please retrigger`,
              completed_at: new Date().toISOString(),
            }, { onConflict: "agency_id,file_type" });
          }
          break;
        }

        const ft = `stop_times_d${dayOffset}_h${currentHour}`;
        const fnUrl = `${supabaseUrl}/functions/v1/${functionName}?agency_id=${encodeURIComponent(agencyId)}&day_offset=${encodeURIComponent(dayOffset)}&hour=${currentHour}&page=${currentPage}`;

        const res = await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
        });

        if (!res.ok) {
          const errText = await res.text();
          
          // Check if this is a retriable error
          if (isRetriableError(errText)) {
            // Get current retry count
            const { data: statusRow } = await supabase
              .from("gtfs_sync_status")
              .select("retry_count")
              .eq("agency_id", agencyId)
              .eq("file_type", ft)
              .single();
            
            const currentRetryCount = statusRow?.retry_count ?? 0;
            const nextRetryCount = currentRetryCount + 1;
            
            if (nextRetryCount <= MAX_RETRIES) {
              // Update status with retry info
              await supabase.from("gtfs_sync_status").upsert({
                agency_id: agencyId,
                file_type: ft,
                status: "running",
                retry_count: nextRetryCount,
                error_msg: `Retry ${nextRetryCount}/${MAX_RETRIES}: ${errText.substring(0, 100)}...`,
                completed_at: null,
              }, { onConflict: "agency_id,file_type" });
              
              // Exponential backoff: 1s, 2s, 4s, 8s, 16s
              const backoffMs = Math.pow(2, nextRetryCount - 1) * 1000;
              console.log(`[${agencyId}] Retry ${nextRetryCount}/${MAX_RETRIES} for hour=${currentHour}, waiting ${backoffMs}ms`);
              await new Promise(r => setTimeout(r, backoffMs));
              
              // Retry same hour/page
              continue;
            }
            
            // Max retries exceeded
            console.log(`[${agencyId}] Max retries (${MAX_RETRIES}) exceeded for hour=${currentHour}`);
            await supabase.from("gtfs_sync_status").upsert({
              agency_id: agencyId,
              file_type: ft,
              status: "error",
              error_msg: `Failed after ${MAX_RETRIES} retries: ${errText.substring(0, 200)}`,
              completed_at: new Date().toISOString(),
            }, { onConflict: "agency_id,file_type" });
            
            // Move to next hour instead of failing the entire sync
            currentHour++;
            currentPage = 0;
            continue;
          }
          
          // Non-retriable error
          await supabase.from("gtfs_sync_status").upsert({
            agency_id: agencyId,
            file_type: ft,
            status: "error",
            error_msg: `Page ${currentPage} failed: ${res.status} - ${errText.substring(0, 200)}`,
            completed_at: new Date().toISOString(),
          }, { onConflict: "agency_id,file_type" });

          return new Response(
            JSON.stringify({ error: `Hour ${currentHour} page ${currentPage} failed`, status: res.status, detail: errText.substring(0, 500) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const data = await res.json();
        const agencyResult = data.results?.[agencyId];

        if (!agencyResult) {
          return new Response(
            JSON.stringify({ error: `No result for agency ${agencyId}`, data }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!agencyResult.ok) {
          // Check if inner function returned a retriable error message
          if (agencyResult.error && isRetriableError(agencyResult.error)) {
            const { data: statusRow } = await supabase
              .from("gtfs_sync_status")
              .select("retry_count")
              .eq("agency_id", agencyId)
              .eq("file_type", ft)
              .single();
            
            const currentRetryCount = statusRow?.retry_count ?? 0;
            const nextRetryCount = currentRetryCount + 1;
            
            if (nextRetryCount <= MAX_RETRIES) {
              await supabase.from("gtfs_sync_status").upsert({
                agency_id: agencyId,
                file_type: ft,
                status: "running",
                retry_count: nextRetryCount,
                error_msg: `Retry ${nextRetryCount}/${MAX_RETRIES}: ${agencyResult.error.substring(0, 100)}...`,
                completed_at: null,
              }, { onConflict: "agency_id,file_type" });
              
              const backoffMs = Math.pow(2, nextRetryCount - 1) * 1000;
              console.log(`[${agencyId}] Retry ${nextRetryCount}/${MAX_RETRIES} for hour=${currentHour}, waiting ${backoffMs}ms`);
              await new Promise(r => setTimeout(r, backoffMs));
              continue;
            }
            
            // Max retries exceeded, move to next hour
            await supabase.from("gtfs_sync_status").upsert({
              agency_id: agencyId,
              file_type: ft,
              status: "error",
              error_msg: `Failed after ${MAX_RETRIES} retries: ${agencyResult.error}`,
              completed_at: new Date().toISOString(),
            }, { onConflict: "agency_id,file_type" });
            
            currentHour++;
            currentPage = 0;
            continue;
          }
          
          return new Response(
            JSON.stringify({ error: agencyResult.error, hour: currentHour, page: currentPage }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Success - reset retry count on successful completion
        if (!agencyResult.hasMore) {
          await supabase.from("gtfs_sync_status").upsert({
            agency_id: agencyId,
            file_type: ft,
            retry_count: 0,  // Reset retry count on success
          }, { onConflict: "agency_id,file_type" });
        }

        totalRows += agencyResult.rows || 0;

        if (agencyResult.hasMore) {
          // More pages within this hour — continue paginating
          currentPage++;
        } else {
          // Hour complete — move to next
          currentHour++;
          currentPage = 0;
        }
      }

      if (timedOut && !singleHour) {
        // Fire continuation from where we left off (non-single-hour mode only)
        const continuationUrl = `${supabaseUrl}/functions/v1/gtfs-sync-paginated?agency_id=${encodeURIComponent(agencyId)}&file_type=stop_times&day_offset=${encodeURIComponent(dayOffset)}&start_hour=${currentHour}&start_page=${currentPage}`;

        console.log(`[${agencyId}] Firing continuation from hour=${currentHour} page=${currentPage}`);
        fetch(continuationUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
        }).catch(e => console.error("Continuation fire failed:", e));

        await new Promise(r => setTimeout(r, 500));

        return new Response(
          JSON.stringify({
            ok: true,
            continued: true,
            agency_id: agencyId,
            file_type: fileType,
            day_offset: dayOffset,
            rowsSoFar: totalRows,
            nextHour: currentHour,
            nextPage: currentPage,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ ok: true, agency_id: agencyId, file_type: fileType, day_offset: dayOffset, totalRows, hoursProcessed: singleHour ? 1 : MAX_HOUR + 1 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      // Original page-based logic for shapes
      let page = startPage;
      const maxPages = 200;

      while (page < maxPages) {
        if (Date.now() - startTime > TIME_BUDGET_MS) {
          console.log(`[${agencyId}] Time budget exceeded at page ${page}, scheduling continuation`);
          timedOut = true;
          break;
        }

        let fnUrl = `${supabaseUrl}/functions/v1/${functionName}?agency_id=${encodeURIComponent(agencyId)}&page=${page}`;

        const res = await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
        });

        if (!res.ok) {
          const errText = await res.text();
          await supabase.from("gtfs_sync_status").upsert({
            agency_id: agencyId,
            file_type: fileType,
            status: "error",
            error_msg: `Page ${page} failed: ${res.status} - ${errText.substring(0, 200)}`,
            completed_at: new Date().toISOString(),
          }, { onConflict: "agency_id,file_type" });

          return new Response(
            JSON.stringify({ error: `Page ${page} failed`, status: res.status, detail: errText.substring(0, 500) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const data = await res.json();
        const agencyResult = data.results?.[agencyId];

        if (!agencyResult) {
          return new Response(
            JSON.stringify({ error: `No result for agency ${agencyId}`, data }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!agencyResult.ok) {
          return new Response(
            JSON.stringify({ error: agencyResult.error, page }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        totalRows += agencyResult.rows || 0;
        if (!agencyResult.hasMore) break;
        page++;
      }

      if (timedOut) {
        const continuationUrl = `${supabaseUrl}/functions/v1/gtfs-sync-paginated?agency_id=${encodeURIComponent(agencyId)}&file_type=${encodeURIComponent(fileType)}&start_page=${page}`;

        console.log(`[${agencyId}] Firing continuation from page ${page}`);
        fetch(continuationUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
        }).catch(e => console.error("Continuation fire failed:", e));

        await new Promise(r => setTimeout(r, 500));

        return new Response(
          JSON.stringify({
            ok: true,
            continued: true,
            agency_id: agencyId,
            file_type: fileType,
            rowsSoFar: totalRows,
            nextPage: page,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ ok: true, agency_id: agencyId, file_type: fileType, totalRows, pages: page + 1 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
