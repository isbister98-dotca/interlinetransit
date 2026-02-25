import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import protobuf from "npm:protobufjs@7.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Types ──────────────────────────────────────────────

type Agency = "GO" | "UP" | "TTC" | "MiWay";
type VehicleType = "train" | "subway" | "tram" | "bus";
interface Vehicle {
  id: string;
  agency: Agency;
  routeId: string;
  routeLabel: string;
  vehicleType: VehicleType;
  lat: number;
  lng: number;
  bearing: number;
  speed?: number;
  occupancy?: "LOW" | "MEDIUM" | "HIGH" | "FULL";
  timestamp: number;
}

// ── Helpers ────────────────────────────────────────────

function mapOccupancy(status?: number): Vehicle["occupancy"] | undefined {
  switch (status) {
    case 0: case 1: return "LOW";
    case 2: return "MEDIUM";
    case 3: case 4: return "HIGH";
    case 5: return "FULL";
    default: return undefined;
  }
}

function inferVehicleType(agency: Agency, routeId: string): VehicleType {
  if (agency === "UP") return "train";
  if (agency === "GO") {
    // If routeId is all letters → train, if has digits → bus
    return /^\d+$/.test(routeId) ? "bus" : "train";
  }
  if (agency === "MiWay") return "bus";
  const num = parseInt(routeId, 10);
  if (!isNaN(num)) {
    if (num >= 1 && num <= 6) return "subway";
    if (num >= 500 && num <= 515) return "tram";
  }
  return "bus";
}

/** Extract route suffix from GO Transit vehicle ID like "01260426-RH" → "RH" */
function parseGoRouteId(rawRouteId: string, vehicleId: string): string {
  // The route is the suffix after the last hyphen in the vehicle ID
  const parts = vehicleId.split("-");
  if (parts.length >= 2) {
    const suffix = parts[parts.length - 1];
    if (suffix.length >= 1) return suffix;
  }
  // Fallback: use last 2 chars of rawRouteId
  return rawRouteId.length > 2 ? rawRouteId.slice(-2) : rawRouteId;
}

// ── GTFS-RT Protobuf schema (inline) ──────────────────

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
            vehicle: { type: "VehiclePosition", id: 4 },
          },
        },
        VehiclePosition: {
          fields: {
            trip: { type: "TripDescriptor", id: 1 },
            vehicle: { type: "VehicleDescriptor", id: 8 },
            position: { type: "Position", id: 2 },
            timestamp: { type: "uint64", id: 5 },
            occupancyStatus: { type: "OccupancyStatus", id: 9 },
          },
        },
        TripDescriptor: {
          fields: {
            tripId: { type: "string", id: 1 },
            routeId: { type: "string", id: 5 },
          },
        },
        VehicleDescriptor: {
          fields: {
            id: { type: "string", id: 1 },
            label: { type: "string", id: 3 },
          },
        },
        Position: {
          fields: {
            latitude: { type: "float", id: 1 },
            longitude: { type: "float", id: 2 },
            bearing: { type: "float", id: 3 },
            speed: { type: "float", id: 5 },
          },
        },
        OccupancyStatus: {
          values: {
            EMPTY: 0,
            MANY_SEATS_AVAILABLE: 1,
            FEW_SEATS_AVAILABLE: 2,
            STANDING_ROOM_ONLY: 3,
            CRUSHED_STANDING_ROOM_ONLY: 4,
            FULL: 5,
            NOT_ACCEPTING_PASSENGERS: 6,
          },
        },
      },
    },
  },
});

const FeedMessage = gtfsRoot.lookupType("transit_realtime.FeedMessage");

// ── Metrolinx (JSON API) ──────────────────────────────

const METROLINX_KEY = "30026966";

async function fetchMetrolinxVehicles(apiPath: string, agency: Agency): Promise<Vehicle[]> {
  const url = `https://api.openmetrolinx.com/OpenDataAPI/${apiPath}?key=${METROLINX_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Metrolinx ${agency}: ${res.status}`);
  const json = await res.json();
  const entities: any[] = json?.entity ?? json?.Entity ?? [];

  return entities
    .filter((e: any) => e?.vehicle?.position)
    .map((e: any): Vehicle => {
      const v = e.vehicle;
      const rawRouteId = v.trip?.routeId ?? v.trip?.route_id ?? "?";
      const vehicleId = v.vehicle?.id ?? e.id ?? "";
      
      // For GO: extract route from vehicle ID suffix (e.g. "01260426-RH" → "RH")
      const routeId = agency === "GO" ? parseGoRouteId(rawRouteId, vehicleId) : rawRouteId;
      
      return {
        id: `${agency.toLowerCase()}-${vehicleId}`,
        agency,
        routeId,
        routeLabel: routeId,
        vehicleType: inferVehicleType(agency, routeId),
        lat: v.position.latitude,
        lng: v.position.longitude,
        bearing: v.position.bearing ?? 0,
        speed: v.position.speed != null ? Math.round(v.position.speed * 3.6) : undefined,
        occupancy: mapOccupancy(v.occupancyStatus ?? v.occupancy_status),
        timestamp: (v.timestamp ?? 0) * 1000 || Date.now(),
      };
    });
}

// ── Protobuf feeds (TTC / MiWay) ─────────────────────

async function fetchProtobufVehicles(url: string, agency: Agency): Promise<Vehicle[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${agency}: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const feed = FeedMessage.decode(buf) as any;

  return (feed.entity ?? [])
    .filter((e: any) => e?.vehicle?.position)
    .map((e: any): Vehicle => {
      const v = e.vehicle;
      const routeId = v.trip?.routeId ?? v.trip?.route_id ?? "?";
      return {
        id: `${agency.toLowerCase()}-${v.vehicle?.id ?? e.id}`,
        agency,
        routeId,
        routeLabel: routeId,
        vehicleType: inferVehicleType(agency, routeId),
        lat: v.position.latitude,
        lng: v.position.longitude,
        bearing: v.position.bearing ?? 0,
        speed: v.position.speed != null ? Math.round(v.position.speed * 3.6) : undefined,
        occupancy: mapOccupancy(v.occupancyStatus ?? v.occupancy_status),
        timestamp: (v.timestamp ?? 0) * 1000 || Date.now(),
      };
    });
}

// ── Main fetch + upsert ──────────────────────────────

async function fetchAndCache(supabase: any) {
  const results = await Promise.allSettled([
    fetchMetrolinxVehicles("api/V1/Gtfs/Feed/VehiclePosition", "GO"),
    fetchMetrolinxVehicles("api/V1/UP/Gtfs/Feed/VehiclePosition", "UP"),
    fetchProtobufVehicles("https://bustime.ttc.ca/gtfsrt/vehicles", "TTC"),
    fetchProtobufVehicles("https://www.miapp.ca/GTFS_RT/Vehicle/VehiclePositions.pb", "MiWay"),
  ]);

  const vehicles: Vehicle[] = [];
  const agencyStatus: Record<string, { ok: boolean; count?: number; error?: string }> = {};

  for (const [i, agency] of (["GO", "UP", "TTC", "MiWay"] as Agency[]).entries()) {
    const r = results[i];
    if (r.status === "fulfilled") {
      vehicles.push(...r.value);
      agencyStatus[agency] = { ok: true, count: r.value.length };
    } else {
      agencyStatus[agency] = { ok: false, error: String(r.reason) };
      console.warn(`${agency} failed:`, r.reason);
    }
  }

  if (vehicles.length > 0) {
    const { error } = await supabase
      .from("vehicle_cache")
      .upsert({
        id: 1,
        vehicles: vehicles,
        updated_at: new Date().toISOString(),
        agency_status: agencyStatus,
      });
    if (error) console.error("Upsert error:", error);
  }

  return { vehicleCount: vehicles.length, agencyStatus };
}

// ── Edge function handler ─────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Run 4 fetch cycles at 0s, 15s, 30s, 45s within one minute
    const allResults = [];
    for (let i = 0; i < 4; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 15_000));
      const result = await fetchAndCache(supabase);
      allResults.push(result);
      console.log(`Cycle ${i}: ${result.vehicleCount} vehicles`);
    }

    return new Response(JSON.stringify({ ok: true, cycles: allResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
