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

async function downloadAndExtract(url: string, targetFiles: string[]): Promise<Record<string, string>> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const files = unzipSync(buf);
  const result: Record<string, string> = {};
  for (const name of targetFiles) {
    const key = Object.keys(files).find(k => k.endsWith(name));
    if (key) result[name] = new TextDecoder().decode(files[key]);
  }
  return result;
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
      // Update sync status
      await supabase.from("gtfs_sync_status").upsert({
        agency_id: agencyId, file_type: "agency", status: "running",
        started_at: new Date().toISOString(), row_count: 0, error_msg: null, completed_at: null,
      }, { onConflict: "agency_id,file_type" });

      try {
        const extracted = await downloadAndExtract(feed.feed_url, ["agency.txt", "feed_info.txt"]);

        // Process agency.txt
        let agencyCount = 0;
        if (extracted["agency.txt"]) {
          const rows = parseCSV(extracted["agency.txt"]);
          await supabase.from("gtfs_agency").delete().eq("agency_id", agencyId);
          const batch = rows.map(r => ({
            agency_id: agencyId,
            gtfs_agency_id: r.agency_id || "default",
            agency_name: r.agency_name || null,
            agency_url: r.agency_url || null,
            agency_timezone: r.agency_timezone || null,
            agency_lang: r.agency_lang || null,
            agency_phone: r.agency_phone || null,
            agency_fare_url: r.agency_fare_url || null,
            agency_email: r.agency_email || null,
          }));
          if (batch.length > 0) {
            const { error } = await supabase.from("gtfs_agency").insert(batch);
            if (error) throw error;
          }
          agencyCount = batch.length;
        }

        // Process feed_info.txt
        let feedInfoCount = 0;
        if (extracted["feed_info.txt"]) {
          const rows = parseCSV(extracted["feed_info.txt"]);
          await supabase.from("gtfs_feed_info").delete().eq("agency_id", agencyId);
          if (rows.length > 0) {
            const r = rows[0];
            const { error } = await supabase.from("gtfs_feed_info").insert({
              agency_id: agencyId,
              feed_publisher_name: r.feed_publisher_name || null,
              feed_publisher_url: r.feed_publisher_url || null,
              feed_lang: r.feed_lang || null,
              feed_start_date: r.feed_start_date || null,
              feed_end_date: r.feed_end_date || null,
              feed_version: r.feed_version || null,
            });
            if (error) throw error;
            feedInfoCount = 1;
          }
        }

        const totalRows = agencyCount + feedInfoCount;
        await supabase.from("gtfs_sync_status").upsert({
          agency_id: agencyId, file_type: "agency", status: "done",
          row_count: totalRows, completed_at: new Date().toISOString(), error_msg: null,
        }, { onConflict: "agency_id,file_type" });

        await supabase.from("gtfs_feeds").update({ last_synced: new Date().toISOString() }).eq("agency_id", agencyId);
        results[agencyId] = { ok: true, rows: totalRows };
      } catch (e) {
        await supabase.from("gtfs_sync_status").upsert({
          agency_id: agencyId, file_type: "agency", status: "error",
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
