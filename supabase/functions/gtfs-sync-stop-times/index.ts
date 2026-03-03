import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "npm:fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Get active service_ids for the next 7 days by checking calendar + calendar_dates */
async function getActiveServiceIds(supabase: any, agencyId: string): Promise<Set<string>> {
  const now = new Date();
  const serviceIds = new Set<string>();
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  // Get next 7 days as YYYYMMDD strings and day-of-week indices
  const days: { dateStr: string; dayIdx: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, "");
    days.push({ dateStr, dayIdx: d.getDay() });
  }

  const startDate = days[0].dateStr;
  const endDate = days[6].dateStr;

  // Fetch calendar entries that overlap with our 7-day window
  const { data: calendars } = await supabase
    .from("gtfs_calendar")
    .select("*")
    .eq("agency_id", agencyId)
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  for (const cal of calendars || []) {
    for (const day of days) {
      if (cal.start_date <= day.dateStr && cal.end_date >= day.dateStr) {
        const dayName = dayNames[day.dayIdx];
        if (cal[dayName]) {
          serviceIds.add(cal.service_id);
        }
      }
    }
  }

  // Check calendar_dates for additions (exception_type=1) and removals (exception_type=2)
  const dateStrings = days.map(d => d.dateStr);
  const { data: exceptions } = await supabase
    .from("gtfs_calendar_dates")
    .select("*")
    .eq("agency_id", agencyId)
    .in("date", dateStrings);

  for (const ex of exceptions || []) {
    if (ex.exception_type === 1) {
      serviceIds.add(ex.service_id);
    }
    // Note: exception_type=2 removes service, but since we're building an inclusive set
    // and the calendar already only adds matching days, this is fine for filtering.
    // For strict correctness we'd need per-day tracking, but for stop_times filtering
    // it's better to include slightly more than miss trips.
  }

  return serviceIds;
}

/** Get trip_ids matching active service_ids */
async function getActiveTripIds(supabase: any, agencyId: string, serviceIds: Set<string>): Promise<Set<string>> {
  const tripIds = new Set<string>();
  const serviceArr = Array.from(serviceIds);

  // Fetch in batches of 100 service_ids to avoid query limits
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

        // Step 3: Download and extract stop_times.txt
        const res = await fetch(feed.feed_url);
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        const zipFiles = unzipSync(buf);
        const key = Object.keys(zipFiles).find(k => k.endsWith("stop_times.txt"));
        if (!key) throw new Error("stop_times.txt not found in zip");

        const text = new TextDecoder().decode(zipFiles[key]);
        const allLines = text.replace(/\r/g, "").split("\n").filter(l => l.trim());
        if (allLines.length < 2) throw new Error("stop_times.txt is empty");

        const headers = allLines[0].split(",").map(h => h.trim().replace(/^\uFEFF/, ""));
        const idxTripId = headers.indexOf("trip_id");
        const idxArrival = headers.indexOf("arrival_time");
        const idxDeparture = headers.indexOf("departure_time");
        const idxStopId = headers.indexOf("stop_id");
        const idxSeq = headers.indexOf("stop_sequence");
        const idxPickup = headers.indexOf("pickup_type");
        const idxDropoff = headers.indexOf("drop_off_type");
        const idxTimepoint = headers.indexOf("timepoint");

        // Step 4: Delete existing stop_times
        // Delete in batches to avoid timeout on large deletes
        let deleteMore = true;
        while (deleteMore) {
          const { data: batch } = await supabase
            .from("gtfs_stop_times")
            .select("trip_id, stop_sequence")
            .eq("agency_id", agencyId)
            .limit(5000);
          if (!batch || batch.length === 0) {
            deleteMore = false;
          } else {
            await supabase.from("gtfs_stop_times").delete().eq("agency_id", agencyId).limit(5000);
            if (batch.length < 5000) deleteMore = false;
          }
        }

        // Step 5: Parse and insert filtered rows in batches
        let totalRows = 0;
        let batch: any[] = [];

        for (let i = 1; i < allLines.length; i++) {
          const vals = allLines[i].split(",");
          const tripId = vals[idxTripId]?.trim();
          if (!tripId || !activeTripIds.has(tripId)) continue;

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

          if (batch.length >= 500) {
            const { error } = await supabase.from("gtfs_stop_times").insert(batch);
            if (error) throw error;
            totalRows += batch.length;
            batch = [];
          }
        }
        if (batch.length > 0) {
          const { error } = await supabase.from("gtfs_stop_times").insert(batch);
          if (error) throw error;
          totalRows += batch.length;
        }

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
