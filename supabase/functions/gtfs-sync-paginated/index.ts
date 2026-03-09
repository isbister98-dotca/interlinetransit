import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Wrapper that auto-chains paginated calls for shapes and stop-times.
 * If it runs out of time, it fires off a continuation call to itself
 * so the sync resumes from where it left off.
 *
 * Query params:
 *   - agency_id (required)
 *   - file_type: "shapes" | "stop_times" (required)
 *   - day_offset: 0–6 (only used when file_type=stop_times)
 *   - start_page: resume from this page (default 0, used for continuation)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const agencyId = url.searchParams.get("agency_id");
    const fileType = url.searchParams.get("file_type");
    const dayOffset = url.searchParams.get("day_offset") ?? "0";
    const startPage = parseInt(url.searchParams.get("start_page") ?? "0");

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

    // Time budget: edge functions have ~150s wall time.
    // Reserve 10s for cleanup/continuation fire, so work for up to 120s.
    const startTime = Date.now();
    const TIME_BUDGET_MS = 120_000;

    let page = startPage;
    let totalRows = 0;
    const maxPages = 200;
    let timedOut = false;

    while (page < maxPages) {
      // Check time budget before starting next page
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        console.log(`[${agencyId}] Time budget exceeded at page ${page}, scheduling continuation`);
        timedOut = true;
        break;
      }

      let fnUrl = `${supabaseUrl}/functions/v1/${functionName}?agency_id=${encodeURIComponent(agencyId)}&page=${page}`;
      if (fileType === "stop_times") {
        fnUrl += `&day_offset=${encodeURIComponent(dayOffset)}`;
      }

      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        const ft = fileType === "stop_times" ? `stop_times_d${dayOffset}` : fileType;
        await supabase.from("gtfs_sync_status").upsert({
          agency_id: agencyId,
          file_type: ft,
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

    // If we ran out of time, fire a continuation call to ourselves
    if (timedOut) {
      const continuationUrl = `${supabaseUrl}/functions/v1/gtfs-sync-paginated?agency_id=${encodeURIComponent(agencyId)}&file_type=${encodeURIComponent(fileType)}&day_offset=${encodeURIComponent(dayOffset)}&start_page=${page}`;

      console.log(`[${agencyId}] Firing continuation from page ${page}`);

      // Fire and forget — don't await
      fetch(continuationUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
      }).catch(e => console.error("Continuation fire failed:", e));

      // Small delay to ensure the fetch is dispatched
      await new Promise(r => setTimeout(r, 500));

      return new Response(
        JSON.stringify({
          ok: true,
          continued: true,
          agency_id: agencyId,
          file_type: fileType,
          day_offset: dayOffset,
          rowsSoFar: totalRows,
          nextPage: page,
          pagesCompleted: page - startPage,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, agency_id: agencyId, file_type: fileType, day_offset: dayOffset, totalRows, pages: page + 1 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
