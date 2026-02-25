import GtfsRt from "gtfs-rt-bindings";
const FeedMessage = GtfsRt.FeedMessage;
import type { Vehicle, Agency } from "./types";
import { MOCK_VEHICLES } from "./mock-data";

const METROLINX_KEY = "30026966";

// Proxy paths (dev) → direct URLs (prod fallback)
const PROXY_METROLINX = "/api/metrolinx/";
const PROXY_TTC = "/api/ttc/";
const PROXY_MIWAY = "/api/miway/";

const DIRECT_METROLINX = "https://api.openmetrolinx.com/OpenDataAPI/";
const DIRECT_TTC = "https://bustime.ttc.ca/";
const DIRECT_MIWAY = "https://www.miapp.ca/";

// ---------- helpers ----------

function mapOccupancy(status?: number): Vehicle["occupancy"] | undefined {
  // GTFS-RT OccupancyStatus enum
  switch (status) {
    case 0: return "LOW";     // EMPTY
    case 1: return "LOW";     // MANY_SEATS_AVAILABLE
    case 2: return "MEDIUM";  // FEW_SEATS_AVAILABLE
    case 3: return "HIGH";    // STANDING_ROOM_ONLY
    case 4: return "HIGH";    // CRUSHED_STANDING_ROOM_ONLY
    case 5: return "FULL";    // FULL
    default: return undefined;
  }
}

// ---------- Metrolinx (JSON) ----------

async function fetchWithFallback(proxyBase: string, directBase: string, path: string): Promise<Response> {
  try {
    const res = await fetch(`${proxyBase}${path}`);
    if (res.ok) return res;
  } catch {
    // proxy unavailable (production) – try direct
  }
  return fetch(`${directBase}${path}`);
}

async function fetchMetrolinxVehicles(apiPath: string, agency: Agency): Promise<Vehicle[]> {
  const path = `${apiPath}?key=${METROLINX_KEY}`;
  const res = await fetchWithFallback(PROXY_METROLINX, DIRECT_METROLINX, path);
  if (!res.ok) throw new Error(`Metrolinx ${agency}: ${res.status}`);

  const json = await res.json();

  // Metrolinx wraps GTFS-RT in a JSON envelope
  const entities: any[] = json?.entity ?? json?.Entity ?? [];

  return entities
    .filter((e: any) => e?.vehicle?.position)
    .map((e: any): Vehicle => {
      const v = e.vehicle;
      return {
        id: `${agency.toLowerCase()}-${v.vehicle?.id ?? e.id}`,
        agency,
        routeId: v.trip?.routeId ?? v.trip?.route_id ?? "?",
        routeLabel: v.trip?.routeId ?? v.trip?.route_id ?? agency,
        lat: v.position.latitude,
        lng: v.position.longitude,
        bearing: v.position.bearing ?? 0,
        speed: v.position.speed != null ? Math.round(v.position.speed * 3.6) : undefined, // m/s → km/h
        occupancy: mapOccupancy(v.occupancyStatus ?? v.occupancy_status),
        timestamp: (v.timestamp ?? 0) * 1000 || Date.now(),
      };
    });
}

// ---------- Protobuf (TTC / MiWay) ----------

async function fetchProtobufVehicles(
  proxyBase: string,
  directBase: string,
  path: string,
  agency: Agency
): Promise<Vehicle[]> {
  const res = await fetchWithFallback(proxyBase, directBase, path);
  if (!res.ok) throw new Error(`${agency}: ${res.status}`);

  const buf = new Uint8Array(await res.arrayBuffer());
  const feed = FeedMessage.decode(buf);

  return (feed.entity ?? [])
    .filter((e: any) => e?.vehicle?.position)
    .map((e: any): Vehicle => {
      const v = e.vehicle;
      return {
        id: `${agency.toLowerCase()}-${v.vehicle?.id ?? e.id}`,
        agency,
        routeId: v.trip?.routeId ?? v.trip?.route_id ?? "?",
        routeLabel: v.trip?.routeId ?? v.trip?.route_id ?? agency,
        lat: v.position.latitude,
        lng: v.position.longitude,
        bearing: v.position.bearing ?? 0,
        speed: v.position.speed != null ? Math.round(v.position.speed * 3.6) : undefined,
        occupancy: mapOccupancy(v.occupancyStatus ?? v.occupancy_status),
        timestamp: (v.timestamp ?? 0) * 1000 || Date.now(),
      };
    });
}

// ---------- Public API ----------

export async function fetchAllVehicles(): Promise<Vehicle[]> {
  const results = await Promise.allSettled([
    fetchMetrolinxVehicles("api/V1/Gtfs/Feed/VehiclePosition", "GO"),
    fetchMetrolinxVehicles("api/V1/UP/Gtfs/Feed/VehiclePosition", "UP"),
    fetchProtobufVehicles(PROXY_TTC, DIRECT_TTC, "gtfsrt/vehicles", "TTC"),
    fetchProtobufVehicles(PROXY_MIWAY, DIRECT_MIWAY, "GTFS_RT/Vehicle/VehiclePositions.pb", "MiWay"),
  ]);

  const vehicles: Vehicle[] = [];
  let anySuccess = false;

  for (const r of results) {
    if (r.status === "fulfilled") {
      vehicles.push(...r.value);
      anySuccess = true;
    } else {
      console.warn("Transit feed failed:", r.reason);
    }
  }

  return anySuccess ? vehicles : MOCK_VEHICLES;
}
