import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "npm:fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^\uFEFF/, ""));
  return lines.slice(1).map(line => {
    const vals = line.split(",");
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? "").trim(); });
    return obj;
  });
}

async function batchInsert(supabase: any, table: string, rows: any[], batchSize = 500) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const agencyFilter = url.searchParams.get("agency_id");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = supabase.from("gtfs_feeds").select("*").eq("is_active", true);
    if (agencyFilter) query = query.eq("agency_id", agencyFilter);
    const { data: feeds, error: feedErr } = await query;
    if (feedErr) throw feedErr;

    const results: Record<string, any> = {};

    for (const feed of feeds || []) {
      const agencyId = feed.agency_id;
      await supabase.from("gtfs_sync_status").upsert({
        agency_id: agencyId, file_type: "routes", status: "running",
        started_at: new Date().toISOString(), row_count: 0, error_msg: null, completed_at: null,
      }, { onConflict: "agency_id,file_type" });

      try {
        const res = await fetch(feed.feed_url);
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        let buf: Uint8Array | null = new Uint8Array(await res.arrayBuffer());
        const files = unzipSync(buf, { filter: (f) => f.name.endsWith("routes.txt") });
        buf = null;
        const key = Object.keys(files).find(k => k.endsWith("routes.txt"));
        if (!key) throw new Error("routes.txt not found in zip");
        const text = new TextDecoder().decode(files[key]);
        delete files[key];
        const rows = parseCSV(text);

        await supabase.from("gtfs_routes").delete().eq("agency_id", agencyId);
        const mapped = rows.map(r => ({
          agency_id: agencyId,
          route_id: r.route_id,
          gtfs_agency_id: r.agency_id || null,
          route_short_name: r.route_short_name || null,
          route_long_name: r.route_long_name || null,
          route_desc: r.route_desc || null,
          route_type: r.route_type ? parseInt(r.route_type) : null,
          route_url: r.route_url || null,
          route_sort_order: r.route_sort_order ? parseInt(r.route_sort_order) : null,
          route_color: r.route_color || null,
          route_text_color: r.route_text_color || null,
        }));
        await batchInsert(supabase, "gtfs_routes", mapped);

        await supabase.from("gtfs_sync_status").upsert({
          agency_id: agencyId, file_type: "routes", status: "done",
          row_count: mapped.length, completed_at: new Date().toISOString(), error_msg: null,
        }, { onConflict: "agency_id,file_type" });
        results[agencyId] = { ok: true, rows: mapped.length };
      } catch (e) {
        await supabase.from("gtfs_sync_status").upsert({
          agency_id: agencyId, file_type: "routes", status: "error",
          error_msg: e.message, completed_at: new Date().toISOString(),
        }, { onConflict: "agency_id,file_type" });
        results[agencyId] = { ok: false, error: e.message };
      }
    }

    return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
