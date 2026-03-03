import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "npm:fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Process a Uint8Array line-by-line without creating the full string.
 *  Calls `onLine` for each line (decoded on the fly). */
function processLines(
  bytes: Uint8Array,
  onHeader: (headers: string[]) => void,
  onLine: (vals: string[]) => void,
) {
  const decoder = new TextDecoder();
  let lineStart = 0;
  let isFirst = true;

  for (let i = 0; i < bytes.length; i++) {
    // Look for \n (0x0A)
    if (bytes[i] === 0x0a) {
      const lineBytes = bytes.subarray(lineStart, i);
      lineStart = i + 1;
      // Decode just this line
      let line = decoder.decode(lineBytes, { stream: true });
      line = line.replace(/\r/g, "").trim();
      if (!line) continue;

      if (isFirst) {
        const headers = line.replace(/^\uFEFF/, "").split(",").map(h => h.trim());
        onHeader(headers);
        isFirst = false;
      } else {
        onLine(line.split(","));
      }
    }
  }

  // Handle last line without trailing newline
  if (lineStart < bytes.length) {
    let line = decoder.decode(bytes.subarray(lineStart)).replace(/\r/g, "").trim();
    if (line) {
      if (isFirst) {
        onHeader(line.replace(/^\uFEFF/, "").split(",").map(h => h.trim()));
      } else {
        onLine(line.split(","));
      }
    }
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
        let buf: Uint8Array | null = new Uint8Array(await res.arrayBuffer());

        // Only extract shapes.txt using filter
        const zipFiles = unzipSync(buf, {
          filter: (file) => file.name.endsWith("shapes.txt"),
        });
        // Free zip buffer immediately
        buf = null;

        const key = Object.keys(zipFiles).find(k => k.endsWith("shapes.txt"));
        if (!key) throw new Error("shapes.txt not found in zip");

        const fileBytes = zipFiles[key];
        // Free the zip object reference to other files
        for (const k of Object.keys(zipFiles)) {
          if (k !== key) delete zipFiles[k];
        }

        // Delete old data
        await supabase.from("gtfs_shapes").delete().eq("agency_id", agencyId);

        let totalRows = 0;
        let batch: any[] = [];
        let idxShapeId = -1, idxLat = -1, idxLon = -1, idxSeq = -1;

        processLines(
          fileBytes,
          (headers) => {
            idxShapeId = headers.indexOf("shape_id");
            idxLat = headers.indexOf("shape_pt_lat");
            idxLon = headers.indexOf("shape_pt_lon");
            idxSeq = headers.indexOf("shape_pt_sequence");
          },
          (vals) => {
            batch.push({
              agency_id: agencyId,
              shape_id: vals[idxShapeId]?.trim() || "",
              shape_pt_lat: parseFloat(vals[idxLat]?.trim() || "0"),
              shape_pt_lon: parseFloat(vals[idxLon]?.trim() || "0"),
              shape_pt_sequence: parseInt(vals[idxSeq]?.trim() || "0"),
            });
          },
        );

        // Insert all rows in batches
        for (let i = 0; i < batch.length; i += 500) {
          const chunk = batch.slice(i, i + 500);
          const { error } = await supabase.from("gtfs_shapes").insert(chunk);
          if (error) throw error;
          totalRows += chunk.length;
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
