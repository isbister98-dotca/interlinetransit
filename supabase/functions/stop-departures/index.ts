import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import protobuf from "npm:protobufjs@7.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── GTFS-RT Protobuf schema for TripUpdates + ServiceAlerts ──

const gtfsRoot = protobuf.Root.fromJSON({
  nested: {
    transit_realtime: {
      nested: {
        FeedMessage: {
          fields: {
            header: { type: "FeedHeader", id: 1 },
            entity: { rule: "repeated", type: "FeedEntity", id: 2 },
          },
        },
        FeedHeader: {
          fields: {
            gtfsRealtimeVersion: { type: "string", id: 1 },
            timestamp: { type: "uint64", id: 4 },
          },
        },
        FeedEntity: {
          fields: {
            id: { type: "string", id: 1 },
            tripUpdate: { type: "TripUpdate", id: 3 },
            alert: { type: "Alert", id: 5 },
          },
        },
        TripUpdate: {
          fields: {
            trip: { type: "TripDescriptor", id: 1 },
            stopTimeUpdate: { rule: "repeated", type: "StopTimeUpdate", id: 2 },
          },
        },
        TripDescriptor: {
          fields: {
            tripId: { type: "string", id: 1 },
            routeId: { type: "string", id: 5 },
            scheduleRelationship: { type: "ScheduleRelationship", id: 4 },
          },
        },
        ScheduleRelationship: {
          values: { SCHEDULED: 0, ADDED: 1, UNSCHEDULED: 2, CANCELED: 3 },
        },
        StopTimeUpdate: {
          fields: {
            stopSequence: { type: "uint32", id: 1 },
            stopId: { type: "string", id: 4 },
            arrival: { type: "StopTimeEvent", id: 2 },
            departure: { type: "StopTimeEvent", id: 3 },
            scheduleRelationship: { type: "StopTimeUpdateRelationship", id: 5 },
          },
        },
        StopTimeUpdateRelationship: {
          values: { SCHEDULED: 0, SKIPPED: 1, NO_DATA: 2 },
        },
        StopTimeEvent: {
          fields: {
            delay: { type: "int32", id: 1 },
            time: { type: "int64", id: 2 },
          },
        },
        Alert: {
          fields: {
            activePeriod: { rule: "repeated", type: "TimeRange", id: 1 },
            informedEntity: { rule: "repeated", type: "EntitySelector", id: 5 },
            headerText: { type: "TranslatedString", id: 10 },
            descriptionText: { type: "TranslatedString", id: 11 },
          },
        },
        TimeRange: {
          fields: {
            start: { type: "uint64", id: 1 },
            end: { type: "uint64", id: 2 },
          },
        },
        EntitySelector: {
          fields: {
            agencyId: { type: "string", id: 1 },
            routeId: { type: "string", id: 2 },
            stopId: { type: "string", id: 6 },
          },
        },
        TranslatedString: {
          fields: {
            translation: { rule: "repeated", type: "Translation", id: 1 },
          },
        },
        Translation: {
          fields: {
            text: { type: "string", id: 1 },
            language: { type: "string", id: 2 },
          },
        },
      },
    },
  },
});

const FeedMessage = gtfsRoot.lookupType("transit_realtime.FeedMessage");

// ── Agency RT feed URLs ──

const METROLINX_KEY = "30026966";

interface AgencyFeeds {
  tripUpdates: string;
  alerts: string;
  format: "json" | "pb";
}

const AGENCY_FEEDS: Record<string, AgencyFeeds> = {
  GO: {
    tripUpdates: `https://api.openmetrolinx.com/OpenDataAPI/api/V1/Gtfs/Feed/TripUpdate?key=${METROLINX_KEY}`,
    alerts: `https://api.openmetrolinx.com/OpenDataAPI/api/V1/Gtfs/Feed/Alert?key=${METROLINX_KEY}`,
    format: "json",
  },
  UP: {
    tripUpdates: `https://api.openmetrolinx.com/OpenDataAPI/api/V1/UP/Gtfs/Feed/TripUpdate?key=${METROLINX_KEY}`,
    alerts: `https://api.openmetrolinx.com/OpenDataAPI/api/V1/UP/Gtfs/Feed/Alert?key=${METROLINX_KEY}`,
    format: "json",
  },
  TTC: {
    tripUpdates: "https://bustime.ttc.ca/gtfsrt/tripupdates",
    alerts: "https://bustime.ttc.ca/gtfsrt/alerts",
    format: "pb",
  },
  MiWay: {
    tripUpdates: "https://www.miapp.ca/GTFS_RT/TripUpdate/TripUpdates.pb",
    alerts: "https://www.miapp.ca/GTFS_RT/Alert/Alerts.pb",
    format: "pb",
  },
};

// ── Helpers ──

function getTodayInfo() {
  // Eastern time
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/Toronto" }));
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayName = days[et.getDay()];
  const dateStr = `${et.getFullYear()}${String(et.getMonth() + 1).padStart(2, "0")}${String(et.getDate()).padStart(2, "0")}`;
  // Current time as HH:MM:SS for comparison (GTFS times can exceed 24:00)
  const currentSeconds = et.getHours() * 3600 + et.getMinutes() * 60 + et.getSeconds();
  return { dayName, dateStr, currentSeconds, now: et };
}

function gtfsTimeToSeconds(time: string): number {
  const [h, m, s] = time.split(":").map(Number);
  return h * 3600 + m * 60 + (s || 0);
}

function secondsToTimeStr(seconds: number): string {
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

async function fetchRtFeed(url: string, format: "json" | "pb"): Promise<any> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    if (format === "json") {
      return await res.json();
    } else {
      const buf = new Uint8Array(await res.arrayBuffer());
      return FeedMessage.decode(buf);
    }
  } catch (e) {
    console.warn("RT fetch failed:", url, e);
    return null;
  }
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const stopId = url.searchParams.get("stop_id");
    const agencyId = url.searchParams.get("agency_id");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    if (!stopId || !agencyId) {
      return new Response(JSON.stringify({ error: "stop_id and agency_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { dayName, dateStr, currentSeconds } = getTodayInfo();

    // 1. Get active service IDs for today
    const { data: calendarRows } = await supabase
      .from("gtfs_calendar")
      .select("service_id")
      .eq("agency_id", agencyId)
      .eq(dayName, true)
      .lte("start_date", dateStr)
      .gte("end_date", dateStr);

    const serviceIds = new Set((calendarRows || []).map((r: any) => r.service_id));

    // Check calendar_dates for additions/removals
    const { data: dateExceptions } = await supabase
      .from("gtfs_calendar_dates")
      .select("service_id, exception_type")
      .eq("agency_id", agencyId)
      .eq("date", dateStr);

    for (const ex of dateExceptions || []) {
      if (ex.exception_type === 1) serviceIds.add(ex.service_id);
      if (ex.exception_type === 2) serviceIds.delete(ex.service_id);
    }

    if (serviceIds.size === 0) {
      return new Response(JSON.stringify({ departures: [], alerts: [], routes: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get stop_times for this stop, joining with trips to filter by service + get route info
    // We need to batch service IDs for the IN filter
    const serviceIdArr = Array.from(serviceIds);

    // Get trips for active services at this stop
    const windowEnd = secondsToTimeStr(currentSeconds + 3 * 3600);
    const { data: stopTimes } = await supabase
      .from("gtfs_stop_times")
      .select("trip_id, departure_time, arrival_time, stop_sequence")
      .eq("agency_id", agencyId)
      .eq("stop_id", stopId)
      .gte("departure_time", secondsToTimeStr(currentSeconds))
      .lte("departure_time", windowEnd)
      .order("departure_time", { ascending: true })
      .limit(100);

    if (!stopTimes || stopTimes.length === 0) {
      return new Response(JSON.stringify({ departures: [], alerts: [], routes: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter to upcoming departures only
    const upcomingStopTimes = stopTimes.filter((st: any) => {
      const depSec = gtfsTimeToSeconds(st.departure_time || st.arrival_time || "99:99:99");
      return depSec >= currentSeconds;
    });

    // Get trip details for these stop times
    const tripIds = [...new Set(upcomingStopTimes.map((st: any) => st.trip_id))];
    
    // Batch query trips (max 200 at a time for the RPC limit)
    const tripMap = new Map<string, any>();
    for (let i = 0; i < tripIds.length; i += 200) {
      const batch = tripIds.slice(i, i + 200);
      const { data: trips } = await supabase
        .from("gtfs_trips")
        .select("trip_id, route_id, service_id, trip_headsign, direction_id, wheelchair_accessible")
        .eq("agency_id", agencyId)
        .in("trip_id", batch);
      
      for (const t of trips || []) {
        if (serviceIds.has(t.service_id)) {
          tripMap.set(t.trip_id, t);
        }
      }
    }

    // Get route info
    const routeIds = [...new Set(Array.from(tripMap.values()).map((t: any) => t.route_id))];
    const routeMap = new Map<string, any>();
    if (routeIds.length > 0) {
      const { data: routes } = await supabase
        .from("gtfs_routes")
        .select("route_id, route_short_name, route_long_name, route_color, route_text_color, route_type")
        .eq("agency_id", agencyId)
        .in("route_id", routeIds);
      
      for (const r of routes || []) {
        routeMap.set(r.route_id, r);
      }
    }

    // Build departure list
    const departures: any[] = [];
    for (const st of upcomingStopTimes) {
      const trip = tripMap.get(st.trip_id);
      if (!trip) continue;

      const route = routeMap.get(trip.route_id);
      const depTime = st.departure_time || st.arrival_time;
      const depSeconds = gtfsTimeToSeconds(depTime);

      departures.push({
        tripId: st.trip_id,
        routeId: trip.route_id,
        routeShortName: route?.route_short_name || trip.route_id,
        routeLongName: route?.route_long_name || "",
        routeColor: route?.route_color || null,
        routeTextColor: route?.route_text_color || null,
        routeType: route?.route_type ?? null,
        headsign: trip.trip_headsign || route?.route_long_name || "Unknown",
        scheduledDeparture: depTime,
        scheduledSeconds: depSeconds,
        stopSequence: st.stop_sequence,
        wheelchairAccessible: trip.wheelchair_accessible === 1,
        // RT fields filled below
        liveDeparture: null,
        delaySeconds: null,
        isLive: false,
        isCancelled: false,
      });
    }

    // Sort by scheduled time, limit
    departures.sort((a, b) => a.scheduledSeconds - b.scheduledSeconds);
    const limitedDepartures = departures.slice(0, limit);

    // 3. Fetch GTFS-RT TripUpdates
    const feeds = AGENCY_FEEDS[agencyId];
    if (feeds) {
      const rtFeed = await fetchRtFeed(feeds.tripUpdates, feeds.format);
      if (rtFeed) {
        const entities = rtFeed.entity || rtFeed.Entity || [];
        // Build lookup: tripId → stopTimeUpdates
        const rtMap = new Map<string, any[]>();
        for (const e of entities) {
          const tu = e.tripUpdate || e.trip_update;
          if (!tu) continue;
          const trip = tu.trip;
          const tripId = trip?.tripId || trip?.trip_id;
          const rel = trip?.scheduleRelationship ?? trip?.schedule_relationship;
          
          const updates = tu.stopTimeUpdate || tu.stop_time_update || [];
          if (tripId) {
            rtMap.set(tripId, updates);
            // Mark cancellations
            if (rel === 3 || rel === "CANCELED") {
              // Find matching departure and mark cancelled
              for (const dep of limitedDepartures) {
                if (dep.tripId === tripId) dep.isCancelled = true;
              }
            }
          }
        }

        // Apply RT data to departures
        for (const dep of limitedDepartures) {
          const updates = rtMap.get(dep.tripId);
          if (!updates) continue;

          // Find the stop_time_update matching our stop
          let matchingUpdate = updates.find(
            (u: any) => (u.stopId || u.stop_id) === stopId
          );
          // Fallback: find by stop_sequence
          if (!matchingUpdate) {
            matchingUpdate = updates.find(
              (u: any) => (u.stopSequence || u.stop_sequence) === dep.stopSequence
            );
          }
          // Fallback: use the last available update (propagated delay)
          if (!matchingUpdate && updates.length > 0) {
            matchingUpdate = updates[updates.length - 1];
          }

          if (matchingUpdate) {
            const depEvent = matchingUpdate.departure || matchingUpdate.arrival;
            if (depEvent) {
              dep.isLive = true;
              if (depEvent.delay != null) {
                dep.delaySeconds = depEvent.delay;
                dep.liveDeparture = secondsToTimeStr(dep.scheduledSeconds + depEvent.delay);
              } else if (depEvent.time) {
                const rtTime = Number(depEvent.time);
                const rtDate = new Date(rtTime * 1000);
                const etStr = rtDate.toLocaleString("en-US", { timeZone: "America/Toronto" });
                const et = new Date(etStr);
                const rtSeconds = et.getHours() * 3600 + et.getMinutes() * 60 + et.getSeconds();
                dep.delaySeconds = rtSeconds - dep.scheduledSeconds;
                dep.liveDeparture = secondsToTimeStr(rtSeconds);
              }
            }
          }
        }
      }
    }

    // 4. Fetch GTFS-RT ServiceAlerts
    const alerts: any[] = [];
    if (feeds) {
      const alertFeed = await fetchRtFeed(feeds.alerts, feeds.format);
      if (alertFeed) {
        const entities = alertFeed.entity || alertFeed.Entity || [];
        for (const e of entities) {
          const alert = e.alert;
          if (!alert) continue;

          const informed = alert.informedEntity || alert.informed_entity || [];
          const isRelevant = informed.some((ie: any) => {
            const ieStopId = ie.stopId || ie.stop_id;
            const ieRouteId = ie.routeId || ie.route_id;
            if (ieStopId === stopId) return true;
            if (ieRouteId && routeIds.includes(ieRouteId)) return true;
            return false;
          });

          if (isRelevant) {
            const headerText = alert.headerText || alert.header_text;
            const descText = alert.descriptionText || alert.description_text;
            alerts.push({
              id: e.id,
              header: headerText?.translation?.[0]?.text || "Service Alert",
              description: descText?.translation?.[0]?.text || "",
            });
          }
        }
      }
    }

    // 5. Build routes list for filter bar
    const routesList = routeIds.map((rid) => {
      const r = routeMap.get(rid);
      return {
        routeId: rid,
        routeShortName: r?.route_short_name || rid,
        routeColor: r?.route_color || null,
        routeTextColor: r?.route_text_color || null,
      };
    });

    return new Response(
      JSON.stringify({
        departures: limitedDepartures,
        alerts,
        routes: routesList,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("stop-departures error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
