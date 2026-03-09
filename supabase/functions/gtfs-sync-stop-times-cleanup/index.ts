import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FILE_TYPE = "stop_times_cleanup";

/**
 * Build the full 7-day union of active service IDs for an agency.
 * Used exclusively for garbage collection — we need to keep trips for any
 * day in the window, so we union all 7 days before deleting.
 */
async function getAllActiveServiceIds(supabase: any, agencyId: string): Promise<Set<string>> {
  const serviceIds = new Set<string>();
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const days: { dateStr: string; dayIdx: number }[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      dateStr: d.toISOString().slice(0, 10).replace(/-/g, ""),
      dayIdx: d.getDay(),
    });
  }

  const { data: calendars } = await supabase
    .from("gtfs_calendar")
    .select("*")
    .eq("agency_id", agencyId)
    .lte("start_date", days[6].dateStr)
    .gte("end_date", days[0].dateStr);

  for (const cal of calendars || []) {
    for (const day of days) {
      if (
        cal.start_date <= day.dateStr &&
        cal.end_date >= day.dateStr &&
        cal[dayNames[day.dayIdx]]
      ) {
        serviceIds.add(cal.service_id);
      }
    }
  }

  // Fallback: if no services match strict date bounds, use day-of-week only
  if (serviceIds.size === 0) {
    console.log(`[${agencyId}] No strict-date services for 7-day window, falling back to day-of-week`);
    const uniqueDays = new Set(days.map(d => dayNames[d.dayIdx]));
    for (const dayCol of uniqueDays) {
      const { data: fallbackCals } = await supabase
        .from("gtfs_calendar")
        .select("*")
        .eq("agency_id", agencyId)
        .eq(dayCol, true);

      for (const cal of fallbackCals || []) {
        serviceIds.add(cal.service_id);
      }
    }
  }

  const { data: exceptions } = await supabase
    .from("gtfs_calendar_dates")
    .select("*")
    .eq("agency_id", agencyId)
    .in("date", days.map(d => d.dateStr));

  for (const ex of exceptions || []) {
    if (ex.exception_type === 1) serviceIds.add(ex.service_id);
    else if (ex.exception_type === 2) serviceIds.delete(ex.service_id);
  }

  return serviceIds;
}

/**
 * Get all active trip IDs for the given service IDs
 */
async function getAllActiveTripIds(
  supabase: any,
  agencyId: string,
  serviceIds: Set<string>
): Promise<Set<string>> {
  const tripIds = new Set<string>();
  const serviceArr = Array.from(serviceIds);

  for (let i = 0; i < serviceArr.length; i += 100) {
    const batch = serviceArr.slice(i, i + 100);
    let offset = 0;
    while (true) {
      const { data } = await supabase
        .from("gtfs_trips")
        .select("trip_id")
        .eq("agency_id", agencyId)
        .in("service_id", batch)
        .range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const t of data) tripIds.add(t.trip_id);
      if (data.length < 1000) break;
      offset += 1000;
    }
  }

  return tripIds;
}

/**
 * Garbage collect: delete stop_times for trips no longer active in any of the next 7 days
 */
async function garbageCollectOldTrips(
  supabase: any,
  agencyId: string,
  activeTripIds: Set<string>
): Promise<number> {
  const existingTripIds = new Set<string>();
  let offset = 0;

  while (true) {
    const { data } = await supabase
      .from("gtfs_stop_times")
      .select("trip_id")
      .eq("agency_id", agencyId)
      .range(offset, offset + 999);

    if (!data || data.length === 0) break;
    for (const row of data) existingTripIds.add(row.trip_id);
    if (data.length < 1000) break;
    offset += 1000;
  }

  const tripsToDelete: string[] = [];
  for (const tripId of existingTripIds) {
    if (!activeTripIds.has(tripId)) tripsToDelete.push(tripId);
  }

  let deletedCount = 0;
  for (let i = 0; i < tripsToDelete.length; i += 100) {
    const batch = tripsToDelete.slice(i, i + 100);
    const { error } = await supabase
      .from("gtfs_stop_times")
      .delete()
      .eq("agency_id", agencyId)
      .in("trip_id", batch);
    if (!error) deletedCount += batch.length;
  }

  return deletedCount;
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
        agency_id: agencyId,
        file_type: FILE_TYPE,
        status: "running",
        started_at: new Date().toISOString(),
        row_count: 0,
        error_msg: null,
        completed_at: null,
      }, { onConflict: "agency_id,file_type" });

      try {
        // Build full 7-day union — safe to delete anything outside this window
        const serviceIds = await getAllActiveServiceIds(supabase, agencyId);
        const activeTripIds = await getAllActiveTripIds(supabase, agencyId, serviceIds);

        const deletedTrips = await garbageCollectOldTrips(supabase, agencyId, activeTripIds);

        const { count } = await supabase
          .from("gtfs_stop_times")
          .select("*", { count: "exact", head: true })
          .eq("agency_id", agencyId);

        await supabase.from("gtfs_sync_status").upsert({
          agency_id: agencyId,
          file_type: FILE_TYPE,
          status: "done",
          row_count: count || 0,
          completed_at: new Date().toISOString(),
          error_msg: deletedTrips > 0 ? `Cleaned up ${deletedTrips} expired trips` : null,
        }, { onConflict: "agency_id,file_type" });

        results[agencyId] = { ok: true, deletedTrips, remainingRows: count };
      } catch (e) {
        await supabase.from("gtfs_sync_status").upsert({
          agency_id: agencyId,
          file_type: FILE_TYPE,
          status: "error",
          error_msg: e.message,
          completed_at: new Date().toISOString(),
        }, { onConflict: "agency_id,file_type" });
        results[agencyId] = { ok: false, error: e.message };
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
