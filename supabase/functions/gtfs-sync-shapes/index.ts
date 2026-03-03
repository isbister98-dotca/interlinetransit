import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "npm:fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAGE_SIZE = 50000; // rows per invocation

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const agencyFilter = url.searchParams.get("agency_id");
    const page = parseInt(url.searchParams.get("page") || "0");

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

      if (page === 0) {
        await supabase.from("gtfs_sync_status").upsert({
          agency_id: agencyId, file_type: "shapes", status: "running",
          started_at: new Date().toISOString(), row_count: 0, error_msg: null, completed_at: null,
        }, { onConflict: "agency_id,file_type" });
      }

      try {
        // Download zip and extract only shapes.txt
        const res = await fetch(feed.feed_url);
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        let buf: Uint8Array | null = new Uint8Array(await res.arrayBuffer());
        const zipFiles = unzipSync(buf, {
          filter: (file) => file.name.endsWith("shapes.txt"),
        });
        buf = null;

        const key = Object.keys(zipFiles).find(k => k.endsWith("shapes.txt"));
        if (!key) throw new Error("shapes.txt not found in zip");

        // Decode once — this is native C++ in V8, very fast
        const text = new TextDecoder().decode(zipFiles[key]);
        // Free decompressed bytes
        delete zipFiles[key];

        // Find header line end
        const firstNewline = text.indexOf("\n");
        if (firstNewline < 0) throw new Error("shapes.txt is empty");

        const headerLine = text.substring(0, firstNewline).replace(/\r/g, "").replace(/^\uFEFF/, "");
        const headers = headerLine.split(",").map(h => h.trim());
        const idxShapeId = headers.indexOf("shape_id");
        const idxLat = headers.indexOf("shape_pt_lat");
        const idxLon = headers.indexOf("shape_pt_lon");
        const idxSeq = headers.indexOf("shape_pt_sequence");

        // Count lines and find the range for this page
        const startLine = page * PAGE_SIZE;
        let lineNum = 0;
        let pos = firstNewline + 1;
        let pageStartPos = -1;
        let processedInPage = 0;

        // Skip to start line
        if (startLine === 0) {
          pageStartPos = pos;
        } else {
          while (pos < text.length && lineNum < startLine) {
            const nl = text.indexOf("\n", pos);
            if (nl < 0) break;
            pos = nl + 1;
            lineNum++;
          }
          pageStartPos = pos;
        }

        // On page 0, delete existing data
        if (page === 0) {
          await supabase.from("gtfs_shapes").delete().eq("agency_id", agencyId);
        }

        // Process PAGE_SIZE lines from pageStartPos
        let batch: any[] = [];
        let totalRows = 0;
        pos = pageStartPos;

        while (pos < text.length && processedInPage < PAGE_SIZE) {
          const nl = text.indexOf("\n", pos);
          const lineEnd = nl < 0 ? text.length : nl;
          const line = text.substring(pos, lineEnd).replace(/\r/g, "").trim();
          pos = nl < 0 ? text.length : nl + 1;

          if (!line) continue;
          processedInPage++;

          const vals = line.split(",");
          batch.push({
            agency_id: agencyId,
            shape_id: vals[idxShapeId]?.trim() || "",
            shape_pt_lat: parseFloat(vals[idxLat]?.trim() || "0"),
            shape_pt_lon: parseFloat(vals[idxLon]?.trim() || "0"),
            shape_pt_sequence: parseInt(vals[idxSeq]?.trim() || "0"),
          });

          if (batch.length >= 2000) {
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

        // Check if there are more lines
        const hasMore = pos < text.length && text.substring(pos).trim().length > 0;

        // Update sync status
        if (!hasMore) {
          // Get total row count from DB
          const { count } = await supabase.from("gtfs_shapes").select("*", { count: "exact", head: true }).eq("agency_id", agencyId);
          await supabase.from("gtfs_sync_status").upsert({
            agency_id: agencyId, file_type: "shapes", status: "done",
            row_count: count || totalRows, completed_at: new Date().toISOString(), error_msg: null,
          }, { onConflict: "agency_id,file_type" });
        }

        results[agencyId] = { ok: true, rows: totalRows, page, hasMore };
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
