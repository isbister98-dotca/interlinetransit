import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "npm:fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseCSVLines(text: string): { headers: string[]; lines: string[] } {
  const allLines = text.replace(/\r/g, "").split("\n").filter(l => l.trim());
  if (allLines.length < 2) return { headers: [], lines: [] };
  const headers = allLines[0].split(",").map(h => h.trim().replace(/^\uFEFF/, ""));
  return { headers, lines: allLines.slice(1) };
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
        agency_id: agencyId, file_type: "shapes", status: "running",
        started_at: new Date().toISOString(), row_count: 0, error_msg: null, completed_at: null,
      }, { onConflict: "agency_id,file_type" });

      try {
        const res = await fetch(feed.feed_url);
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        const zipFiles = unzipSync(buf);
        const key = Object.keys(zipFiles).find(k => k.endsWith("shapes.txt"));
        if (!key) throw new Error("shapes.txt not found in zip");

        const text = new TextDecoder().decode(zipFiles[key]);
        const { headers, lines } = parseCSVLines(text);
        const idxShapeId = headers.indexOf("shape_id");
        const idxLat = headers.indexOf("shape_pt_lat");
        const idxLon = headers.indexOf("shape_pt_lon");
        const idxSeq = headers.indexOf("shape_pt_sequence");

        // Delete old data
        await supabase.from("gtfs_shapes").delete().eq("agency_id", agencyId);

        // Process and insert in batches
        let totalRows = 0;
        let batch: any[] = [];

        for (const line of lines) {
          const vals = line.split(",");
          batch.push({
            agency_id: agencyId,
            shape_id: vals[idxShapeId]?.trim() || "",
            shape_pt_lat: parseFloat(vals[idxLat]?.trim() || "0"),
            shape_pt_lon: parseFloat(vals[idxLon]?.trim() || "0"),
            shape_pt_sequence: parseInt(vals[idxSeq]?.trim() || "0"),
          });

          if (batch.length >= 500) {
            const { error } = await supabase.from("gtfs_shapes").insert(batch);
            if (error) throw error;
            totalRows += batch.length;
            batch = [];
          }
        }
        if (batch.length > 0) {
          const { error } = await supabase.from("gtfs_shapes").insert(batch);
          if (error) throw error;
          totalRows += batch.length;
        }

        await supabase.from("gtfs_sync_status").upsert({
          agency_id: agencyId, file_type: "shapes", status: "done",
          row_count: totalRows, completed_at: new Date().toISOString(), error_msg: null,
        }, { onConflict: "agency_id,file_type" });
        results[agencyId] = { ok: true, rows: totalRows };
      } catch (e) {
        await supabase.from("gtfs_sync_status").upsert({
          agency_id: agencyId, file_type: "shapes", status: "error",
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
