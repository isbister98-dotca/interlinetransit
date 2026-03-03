import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Wrapper that auto-chains paginated calls for shapes and stop-times.
 * Query params:
 *   - agency_id (required)
 *   - file_type: "shapes" | "stop_times" (required)
 * 
 * This function calls the underlying gtfs-sync-shapes or gtfs-sync-stop-times
 * function repeatedly (page=0, page=1, ...) until hasMore is false.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const agencyId = url.searchParams.get("agency_id");
    const fileType = url.searchParams.get("file_type");

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

    let page = 0;
    let totalRows = 0;
    const maxPages = 100; // safety limit

    while (page < maxPages) {
      const fnUrl = `${supabaseUrl}/functions/v1/${functionName}?agency_id=${encodeURIComponent(agencyId)}&page=${page}`;
      
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        // Update sync status with error
        const supabase = createClient(supabaseUrl, serviceRoleKey);
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

      if (!agencyResult.hasMore) {
        break;
      }

      page++;
    }

    return new Response(
      JSON.stringify({ ok: true, agency_id: agencyId, file_type: fileType, totalRows, pages: page + 1 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
