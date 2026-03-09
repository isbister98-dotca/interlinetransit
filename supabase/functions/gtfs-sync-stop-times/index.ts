import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Unzip, UnzipInflate, UnzipFile } from "npm:fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Reduced page size for reliable execution within 60s timeout
const PAGE_SIZE = 30000;
const BATCH_SIZE = 500;

/**
 * Get active service IDs for the next 14 days based on calendar and exceptions
 */
async function getActiveServiceIds(supabase: any, agencyId: string): Promise<Set<string>> {
  const now = new Date();
  const serviceIds = new Set<string>();
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const days: { dateStr: string; dayIdx: number }[] = [];
  
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    days.push({ dateStr: d.toISOString().slice(0, 10).replace(/-/g, ""), dayIdx: d.getDay() });
  }
  
  const { data: calendars } = await supabase
    .from("gtfs_calendar").select("*").eq("agency_id", agencyId)
    .lte("start_date", days[13].dateStr).gte("end_date", days[0].dateStr);
    
  for (const cal of calendars || []) {
    for (const day of days) {
      if (cal.start_date <= day.dateStr && cal.end_date >= day.dateStr && cal[dayNames[day.dayIdx]])
        serviceIds.add(cal.service_id);
    }
  }
  
  const { data: exceptions } = await supabase
    .from("gtfs_calendar_dates").select("*").eq("agency_id", agencyId)
    .in("date", days.map(d => d.dateStr));
    
  for (const ex of exceptions || []) {
    if (ex.exception_type === 1) serviceIds.add(ex.service_id);
  }
  
  return serviceIds;
}

/**
 * Get all active trip IDs for the given service IDs
 */
async function getActiveTripIds(supabase: any, agencyId: string, serviceIds: Set<string>): Promise<Set<string>> {
  const tripIds = new Set<string>();
  const serviceArr = Array.from(serviceIds);
  
  for (let i = 0; i < serviceArr.length; i += 100) {
    const batch = serviceArr.slice(i, i + 100);
    let offset = 0;
    while (true) {
      const { data } = await supabase.from("gtfs_trips").select("trip_id")
        .eq("agency_id", agencyId).in("service_id", batch).range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const t of data) tripIds.add(t.trip_id);
      if (data.length < 1000) break;
      offset += 1000;
    }
  }
  
  return tripIds;
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(value);
      value = "";
      continue;
    }
    value += ch;
  }
  out.push(value);
  return out;
}

/**
 * Stream-process the ZIP file and extract stop_times.txt lines
 * Uses fflate streaming to minimize memory usage
 */
async function streamProcessZip(
  feedUrl: string,
  onLine: (line: string) => void
): Promise<void> {
  const response = await fetch(feedUrl);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  if (!response.body) throw new Error("No response body");

  return new Promise((resolve, reject) => {
    const decoder = new TextDecoder();
    let lineBuffer = "";
    let foundStopTimes = false;
    let stopTimesComplete = false;

    const unzip = new Unzip((file: UnzipFile) => {
      if (stopTimesComplete) return;
      
      if (file.name.endsWith("stop_times.txt")) {
        foundStopTimes = true;
        
        file.ondata = (err, data, final) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (data && data.length > 0) {
            lineBuffer += decoder.decode(data, { stream: !final });
            
            let nlIndex = lineBuffer.indexOf("\n");
            while (nlIndex >= 0) {
              const line = lineBuffer.slice(0, nlIndex).replace(/\r/g, "").trim();
              if (line) onLine(line);
              lineBuffer = lineBuffer.slice(nlIndex + 1);
              nlIndex = lineBuffer.indexOf("\n");
            }
          }
          
          if (final) {
            // Process any remaining content
            const finalLine = lineBuffer.replace(/\r/g, "").trim();
            if (finalLine) onLine(finalLine);
            stopTimesComplete = true;
            resolve();
          }
        };
        
        file.start();
      }
    });

    unzip.register(UnzipInflate);

    const reader = response.body.getReader();
    
    async function pump(): Promise<void> {
      try {
        while (!stopTimesComplete) {
          const { done, value } = await reader.read();
          
          if (done) {
            unzip.push(new Uint8Array(0), true);
            if (!foundStopTimes) {
              reject(new Error("stop_times.txt not found in zip"));
            }
            return;
          }
          
          if (value) {
            unzip.push(value);
          }
        }
      } catch (e) {
        reject(e);
      }
    }

    pump().catch(reject);
  });
}

/**
 * Garbage collect: delete stop_times for trips that are no longer active
 */
async function garbageCollectOldTrips(
  supabase: any,
  agencyId: string,
  activeTripIds: Set<string>
): Promise<number> {
  // Get all trip_ids currently in stop_times for this agency
  const existingTripIds = new Set<string>();
  let offset = 0;
  
  while (true) {
    const { data } = await supabase
      .from("gtfs_stop_times")
      .select("trip_id")
      .eq("agency_id", agencyId)
      .range(offset, offset + 999);
      
    if (!data || data.length === 0) break;
    
    for (const row of data) {
      existingTripIds.add(row.trip_id);
    }
    
    if (data.length < 1000) break;
    offset += 1000;
  }

  // Find trip_ids to delete (in DB but not in active set)
  const tripsToDelete: string[] = [];
  for (const tripId of existingTripIds) {
    if (!activeTripIds.has(tripId)) {
      tripsToDelete.push(tripId);
    }
  }

  // Delete in batches
  let deletedCount = 0;
  for (let i = 0; i < tripsToDelete.length; i += 100) {
    const batch = tripsToDelete.slice(i, i + 100);
    const { error } = await supabase
      .from("gtfs_stop_times")
      .delete()
      .eq("agency_id", agencyId)
      .in("trip_id", batch);
      
    if (!error) {
      deletedCount += batch.length;
    }
  }

  return deletedCount;
}

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
          agency_id: agencyId,
          file_type: "stop_times",
          status: "running",
          started_at: new Date().toISOString(),
          row_count: 0,
          error_msg: null,
          completed_at: null,
        }, { onConflict: "agency_id,file_type" });
      }

      try {
        // Get active services and trips for the next 14 days
        const serviceIds = await getActiveServiceIds(supabase, agencyId);
        if (serviceIds.size === 0) {
          await supabase.from("gtfs_sync_status").upsert({
            agency_id: agencyId,
            file_type: "stop_times",
            status: "done",
            row_count: 0,
            completed_at: new Date().toISOString(),
            error_msg: "No active services found for next 14 days",
          }, { onConflict: "agency_id,file_type" });
          results[agencyId] = { ok: true, rows: 0, note: "No active services" };
          continue;
        }
        
        const activeTripIds = await getActiveTripIds(supabase, agencyId, serviceIds);
        if (activeTripIds.size === 0) {
          await supabase.from("gtfs_sync_status").upsert({
            agency_id: agencyId,
            file_type: "stop_times",
            status: "done",
            row_count: 0,
            completed_at: new Date().toISOString(),
            error_msg: "No active trips found for next 14 days",
          }, { onConflict: "agency_id,file_type" });
          results[agencyId] = { ok: true, rows: 0, note: "No active trips" };
          continue;
        }

        // Column indices
        let idxTripId = -1;
        let idxArrival = -1;
        let idxDeparture = -1;
        let idxStopId = -1;
        let idxSeq = -1;
        let idxPickup = -1;
        let idxDropoff = -1;
        let idxTimepoint = -1;
        let headerParsed = false;

        const skipUntil = page * PAGE_SIZE;
        let matchedCount = 0;
        let processedInPage = 0;
        let hasMore = false;
        let batch: any[] = [];
        let totalRows = 0;

        // Stream process the ZIP file
        await streamProcessZip(feed.feed_url, (line: string) => {
          if (hasMore) return; // Stop processing if we've hit the page limit
          
          if (!headerParsed) {
            const headers = parseCsvLine(line.replace(/^\uFEFF/, "")).map(h => h.trim());
            idxTripId = headers.indexOf("trip_id");
            idxArrival = headers.indexOf("arrival_time");
            idxDeparture = headers.indexOf("departure_time");
            idxStopId = headers.indexOf("stop_id");
            idxSeq = headers.indexOf("stop_sequence");
            idxPickup = headers.indexOf("pickup_type");
            idxDropoff = headers.indexOf("drop_off_type");
            idxTimepoint = headers.indexOf("timepoint");

            if (idxTripId < 0 || idxStopId < 0 || idxSeq < 0) {
              throw new Error("stop_times.txt missing required columns");
            }
            headerParsed = true;
            return;
          }

          const vals = parseCsvLine(line);
          const tripId = vals[idxTripId]?.trim();
          
          // Skip if trip is not in active set
          if (!tripId || !activeTripIds.has(tripId)) return;

          // Skip rows until we reach our page offset
          if (matchedCount < skipUntil) {
            matchedCount++;
            return;
          }

          // Check if we've processed enough for this page
          if (processedInPage >= PAGE_SIZE) {
            hasMore = true;
            return;
          }

          processedInPage++;
          matchedCount++;

          batch.push({
            agency_id: agencyId,
            trip_id: tripId,
            stop_id: vals[idxStopId]?.trim() || "",
            stop_sequence: parseInt(vals[idxSeq]?.trim() || "0"),
            arrival_time: idxArrival >= 0 ? (vals[idxArrival]?.trim() || null) : null,
            departure_time: idxDeparture >= 0 ? (vals[idxDeparture]?.trim() || null) : null,
            pickup_type: idxPickup >= 0 && vals[idxPickup]?.trim() ? parseInt(vals[idxPickup].trim()) : null,
            drop_off_type: idxDropoff >= 0 && vals[idxDropoff]?.trim() ? parseInt(vals[idxDropoff].trim()) : null,
            timepoint: idxTimepoint >= 0 && vals[idxTimepoint]?.trim() ? parseInt(vals[idxTimepoint].trim()) : null,
          });
        });

        // Upsert remaining batch (no DELETE - zero downtime!)
        if (batch.length > 0) {
          // Process in smaller chunks for reliability
          for (let i = 0; i < batch.length; i += BATCH_SIZE) {
            const chunk = batch.slice(i, i + BATCH_SIZE);
            let attempt = 0;
            while (attempt < 3) {
              const { error } = await supabase
                .from("gtfs_stop_times")
                .upsert(chunk, { onConflict: "agency_id,trip_id,stop_sequence" });
              if (!error) break;
              attempt++;
              if (attempt >= 3) throw error;
              await new Promise(r => setTimeout(r, 1000));
            }
            totalRows += chunk.length;
          }
        }

        if (!headerParsed) throw new Error("stop_times.txt is empty");

        // If this is the final page, run garbage collection
        if (!hasMore) {
          const deletedTrips = await garbageCollectOldTrips(supabase, agencyId, activeTripIds);
          
          const { count } = await supabase
            .from("gtfs_stop_times")
            .select("*", { count: "exact", head: true })
            .eq("agency_id", agencyId);
            
          await supabase.from("gtfs_sync_status").upsert({
            agency_id: agencyId,
            file_type: "stop_times",
            status: "done",
            row_count: count || totalRows,
            completed_at: new Date().toISOString(),
            error_msg: deletedTrips > 0 ? `Cleaned up ${deletedTrips} expired trips` : null,
          }, { onConflict: "agency_id,file_type" });
        }

        results[agencyId] = { ok: true, rows: totalRows, page, hasMore };
      } catch (e) {
        await supabase.from("gtfs_sync_status").upsert({
          agency_id: agencyId,
          file_type: "stop_times",
          status: "error",
          error_msg: e.message,
          completed_at: new Date().toISOString(),
        }, { onConflict: "agency_id,file_type" });
        results[agencyId] = { ok: false, error: e.message };
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
