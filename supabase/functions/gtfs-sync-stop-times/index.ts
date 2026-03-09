import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "npm:fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAGE_SIZE = 50000;
const CSV_DECODE_CHUNK_BYTES = 256 * 1024;

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

function getCsvFieldAtIndex(line: string, targetIndex: number): string {
  if (targetIndex < 0) return "";

  let currentIndex = 0;
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        if (currentIndex === targetIndex) value += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      if (currentIndex === targetIndex) return value;
      currentIndex++;
      value = "";
      continue;
    }

    if (currentIndex === targetIndex) value += ch;
  }

  return currentIndex === targetIndex ? value : "";
}

function* iterateCsvLines(bytes: Uint8Array): Generator<string, void, unknown> {
  const decoder = new TextDecoder();
  let carry = "";

  for (let offset = 0; offset < bytes.length; offset += CSV_DECODE_CHUNK_BYTES) {
    const chunk = bytes.subarray(offset, Math.min(offset + CSV_DECODE_CHUNK_BYTES, bytes.length));
    carry += decoder.decode(chunk, { stream: true });

    let nl = carry.indexOf("\n");
    while (nl >= 0) {
      const line = carry.slice(0, nl).replace(/\r/g, "");
      yield line;
      carry = carry.slice(nl + 1);
      nl = carry.indexOf("\n");
    }
  }

  carry += decoder.decode();
  const finalLine = carry.replace(/\r/g, "");
  if (finalLine) yield finalLine;
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
          agency_id: agencyId, file_type: "stop_times", status: "running",
          started_at: new Date().toISOString(), row_count: 0, error_msg: null, completed_at: null,
        }, { onConflict: "agency_id,file_type" });
      }

      try {
        // Step 1: Get active trip_ids (only on page 0 matters for filtering, but we need it every page)
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
        const activeTripIds = await getActiveTripIds(supabase, agencyId, serviceIds);

        // Step 2: Download zip, extract only stop_times.txt
        const res = await fetch(feed.feed_url);
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        let buf: Uint8Array | null = new Uint8Array(await res.arrayBuffer());
        const zipFiles = unzipSync(buf, {
          filter: (file) => file.name.endsWith("stop_times.txt"),
        });
        buf = null;

        const key = Object.keys(zipFiles).find(k => k.endsWith("stop_times.txt"));
        if (!key) throw new Error("stop_times.txt not found in zip");

        let stopTimesBytes: Uint8Array | null = zipFiles[key];
        delete zipFiles[key];

        if (!stopTimesBytes) throw new Error("stop_times.txt is empty");

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

        // On page 0, delete existing data
        if (page === 0) {
          await supabase.from("gtfs_stop_times").delete().eq("agency_id", agencyId);
        }

        for (const rawLine of iterateCsvLines(stopTimesBytes)) {
          const line = rawLine.trim();
          if (!line) continue;

          if (!headerParsed) {
            const headers = parseCsvLine(line.replace(/^\uFEFF/, "")).map((h) => h.trim());
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
            continue;
          }

          const tripId = getCsvFieldAtIndex(line, idxTripId).trim();
          if (!tripId || !activeTripIds.has(tripId)) continue;

          if (matchedCount < skipUntil) {
            matchedCount++;
            continue;
          }

          if (processedInPage >= PAGE_SIZE) {
            hasMore = true;
            break;
          }

          const vals = parseCsvLine(line);
          processedInPage++;

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

          if (batch.length >= 2000) {
            const { error } = await supabase.from("gtfs_stop_times").upsert(batch, { onConflict: "agency_id,trip_id,stop_sequence" });
            if (error) throw error;
            totalRows += batch.length;
            batch = [];
          }
        }

        stopTimesBytes = null;

        if (!headerParsed) throw new Error("stop_times.txt is empty");

        if (batch.length > 0) {
          const { error } = await supabase.from("gtfs_stop_times").upsert(batch, { onConflict: "agency_id,trip_id,stop_sequence" });
          if (error) throw error;
          totalRows += batch.length;
        }

        if (!hasMore) {
          const { count } = await supabase.from("gtfs_stop_times").select("*", { count: "exact", head: true }).eq("agency_id", agencyId);
          await supabase.from("gtfs_sync_status").upsert({
            agency_id: agencyId, file_type: "stop_times", status: "done",
            row_count: count || totalRows, completed_at: new Date().toISOString(), error_msg: null,
          }, { onConflict: "agency_id,file_type" });
        }

        results[agencyId] = { ok: true, rows: totalRows, page, hasMore };
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
