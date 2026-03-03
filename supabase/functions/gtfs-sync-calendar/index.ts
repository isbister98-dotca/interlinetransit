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

function toBool(val: string): boolean {
  return val === "1";
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
        agency_id: agencyId, file_type: "calendar", status: "running",
        started_at: new Date().toISOString(), row_count: 0, error_msg: null, completed_at: null,
      }, { onConflict: "agency_id,file_type" });

      try {
        const extracted = await downloadAndExtract(feed.feed_url, ["calendar.txt", "calendar_dates.txt"]);
        let totalRows = 0;

        // calendar.txt
        if (extracted["calendar.txt"]) {
          const rows = parseCSV(extracted["calendar.txt"]);
          await supabase.from("gtfs_calendar").delete().eq("agency_id", agencyId);
          const mapped = rows.map(r => ({
            agency_id: agencyId,
            service_id: r.service_id,
            monday: toBool(r.monday),
            tuesday: toBool(r.tuesday),
            wednesday: toBool(r.wednesday),
            thursday: toBool(r.thursday),
            friday: toBool(r.friday),
            saturday: toBool(r.saturday),
            sunday: toBool(r.sunday),
            start_date: r.start_date,
            end_date: r.end_date,
          }));
          await batchInsert(supabase, "gtfs_calendar", mapped);
          totalRows += mapped.length;
        }

        // calendar_dates.txt
        if (extracted["calendar_dates.txt"]) {
          const rows = parseCSV(extracted["calendar_dates.txt"]);
          await supabase.from("gtfs_calendar_dates").delete().eq("agency_id", agencyId);
          const mapped = rows.map(r => ({
            agency_id: agencyId,
            service_id: r.service_id,
            date: r.date,
            exception_type: parseInt(r.exception_type) || 1,
          }));
          await batchInsert(supabase, "gtfs_calendar_dates", mapped);
          totalRows += mapped.length;
        }

        await supabase.from("gtfs_sync_status").upsert({
          agency_id: agencyId, file_type: "calendar", status: "done",
          row_count: totalRows, completed_at: new Date().toISOString(), error_msg: null,
        }, { onConflict: "agency_id,file_type" });
        results[agencyId] = { ok: true, rows: totalRows };
      } catch (e) {
        await supabase.from("gtfs_sync_status").upsert({
          agency_id: agencyId, file_type: "calendar", status: "error",
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
