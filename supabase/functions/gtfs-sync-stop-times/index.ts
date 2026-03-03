import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "npm:fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getActiveServiceIds(supabase: any, agencyId: string): Promise<Set<string>> {
  const now = new Date();
  const serviceIds = new Set<string>();
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  const days: { dateStr: string; dayIdx: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, "");
    days.push({ dateStr, dayIdx: d.getDay() });
  }

  const startDate = days[0].dateStr;
  const endDate = days[6].dateStr;

  const { data: calendars } = await supabase
    .from("gtfs_calendar")
    .select("*")
    .eq("agency_id", agencyId)
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  for (const cal of calendars || []) {
    for (const day of days) {
      if (cal.start_date <= day.dateStr && cal.end_date >= day.dateStr) {
        if (cal[dayNames[day.dayIdx]]) serviceIds.add(cal.service_id);
      }
    }
  }

  const dateStrings = days.map(d => d.dateStr);
  const { data: exceptions } = await supabase
    .from("gtfs_calendar_dates")
    .select("*")
    .eq("agency_id", agencyId)
    .in("date", dateStrings);

  for (const ex of exceptions || []) {
    if (ex.exception_type === 1) serviceIds.add(ex.service_id);
  }

  return serviceIds;
}

async function getActiveTripIds(supabase: any, agencyId: string, serviceIds: Set<string>): Promise<Set<string>> {
  const tripIds = new Set<string>();
  const serviceArr = Array.from(serviceIds);

  for (let i = 0; i < serviceArr.length; i += 100) {
    const batch = serviceArr.slice(i, i + 100);
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const { data } = await supabase
        .from("gtfs_trips")
        .select("trip_id")
        .eq("agency_id", agencyId)
        .in("service_id", batch)
        .range(offset, offset + pageSize - 1);
      if (!data || data.length === 0) break;
      for (const t of data) tripIds.add(t.trip_id);
      if (data.length < pageSize) break;
      offset += pageSize;
    }
  }

  return tripIds;
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
        agency_id: agencyId, file_type: "stop_times", status: "running",
        started_at: new Date().toISOString(), row_count: 0, error_msg: null, completed_at: null,
      }, { onConflict: "agency_id,file_type" });

      try {
        // Step 1: Get active service_ids for the next 7 days
        const serviceIds = await getActiveServiceIds(supabase, agencyId);
        if (serviceIds.size === 0) {
          await supabase.from("gtfs_sync_status").upsert({
            agency_id: agencyId, file_type: "stop_times", status: "done",
            row_count: 0, completed_at: new Date().toISOString(),
            error_msg: "No active services found for next 7 days",
          }, { onConflict: "agency_id,file_type" });
          results[agencyId] = { ok: true, rows: 0, note: "No active services" };
          continue;
        }

        // Step 2: Get trip_ids matching those services
        const activeTripIds = await getActiveTripIds(supabase, agencyId, serviceIds);

        // Step 3: Download zip, only extract stop_times.txt
        const res = await fetch(feed.feed_url);
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        let buf: Uint8Array | null = new Uint8Array(await res.arrayBuffer());

        const zipFiles = unzipSync(buf, {
          filter: (file) => file.name.endsWith("stop_times.txt"),
        });
        // Free zip buffer immediately
        buf = null;

        const key = Object.keys(zipFiles).find(k => k.endsWith("stop_times.txt"));
        if (!key) throw new Error("stop_times.txt not found in zip");

        const fileBytes = zipFiles[key];
        // Free other entries
        for (const k of Object.keys(zipFiles)) {
          if (k !== key) delete zipFiles[k];
        }

        // Step 4: Delete existing stop_times
        await supabase.from("gtfs_stop_times").delete().eq("agency_id", agencyId);

        // Step 5: Stream-parse the bytes line by line, filter by active trips, batch insert
        const decoder = new TextDecoder();
        let lineStart = 0;
        let isFirst = true;
        let idxTripId = -1, idxArrival = -1, idxDeparture = -1;
        let idxStopId = -1, idxSeq = -1, idxPickup = -1, idxDropoff = -1, idxTimepoint = -1;
        let totalRows = 0;
        let batch: any[] = [];

        async function flushBatch() {
          if (batch.length === 0) return;
          const { error } = await supabase.from("gtfs_stop_times").insert(batch);
          if (error) throw error;
          totalRows += batch.length;
          batch = [];
        }

        function processLine(line: string) {
          line = line.replace(/\r/g, "").trim();
          if (!line) return;

          if (isFirst) {
            const headers = line.replace(/^\uFEFF/, "").split(",").map(h => h.trim());
            idxTripId = headers.indexOf("trip_id");
            idxArrival = headers.indexOf("arrival_time");
            idxDeparture = headers.indexOf("departure_time");
            idxStopId = headers.indexOf("stop_id");
            idxSeq = headers.indexOf("stop_sequence");
            idxPickup = headers.indexOf("pickup_type");
            idxDropoff = headers.indexOf("drop_off_type");
            idxTimepoint = headers.indexOf("timepoint");
            isFirst = false;
            return;
          }

          const vals = line.split(",");
          const tripId = vals[idxTripId]?.trim();
          if (!tripId || !activeTripIds.has(tripId)) return;

          batch.push({
            agency_id: agencyId,
            trip_id: tripId,
            stop_id: vals[idxStopId]?.trim() || "",
            stop_sequence: parseInt(vals[idxSeq]?.trim() || "0"),
            arrival_time: vals[idxArrival]?.trim() || null,
            departure_time: vals[idxDeparture]?.trim() || null,
            pickup_type: idxPickup >= 0 && vals[idxPickup]?.trim() ? parseInt(vals[idxPickup].trim()) : null,
            drop_off_type: idxDropoff >= 0 && vals[idxDropoff]?.trim() ? parseInt(vals[idxDropoff].trim()) : null,
            timepoint: idxTimepoint >= 0 && vals[idxTimepoint]?.trim() ? parseInt(vals[idxTimepoint].trim()) : null,
          });
        }

        // Process bytes in 1MB chunks to avoid creating one massive string
        const CHUNK_SIZE = 1024 * 1024; // 1MB
        let leftover = "";

        for (let offset = 0; offset < fileBytes.length; offset += CHUNK_SIZE) {
          const end = Math.min(offset + CHUNK_SIZE, fileBytes.length);
          const chunkText = leftover + decoder.decode(fileBytes.subarray(offset, end), { stream: end < fileBytes.length });
          const lines = chunkText.split("\n");

          // Last element may be incomplete — save as leftover
          leftover = lines.pop() || "";

          for (const line of lines) {
            processLine(line);
            if (batch.length >= 500) {
              await flushBatch();
            }
          }
        }

        // Process leftover
        if (leftover.trim()) {
          processLine(leftover);
        }
        await flushBatch();

        await supabase.from("gtfs_sync_status").upsert({
          agency_id: agencyId, file_type: "stop_times", status: "done",
          row_count: totalRows, completed_at: new Date().toISOString(), error_msg: null,
        }, { onConflict: "agency_id,file_type" });
        results[agencyId] = { ok: true, rows: totalRows, services: serviceIds.size, trips: activeTripIds.size };
      } catch (e) {
        await supabase.from("gtfs_sync_status").upsert({
          agency_id: agencyId, file_type: "stop_times", status: "error",
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
