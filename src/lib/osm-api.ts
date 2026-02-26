import { MOCK_DEPARTURES, MOCK_ALERTS } from "./mock-data";
import type { Vehicle } from "./types";

// --- Types ---
export interface PlaceResult {
  type: "place";
  osmId: string;
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
  displayName: string;
}

export interface StationResult {
  type: "station";
  osmId: string;
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
}

export interface RouteResult {
  type: "route";
  routeId: string;
  routeLabel: string;
  agency: string;
  vehicleCount: number;
}

export type SearchResult = PlaceResult | StationResult | RouteResult;

const GTA_VIEWBOX = "-80.2,44.2,-78.5,43.2";

// --- Forward geocoding (places) ---
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=5&viewbox=${GTA_VIEWBOX}&bounded=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    return (data as any[])
      .filter((d) => d.class !== "railway" && d.type !== "station")
      .map((d) => ({
        type: "place" as const,
        osmId: String(d.osm_id),
        name: d.address?.amenity || d.address?.building || d.address?.road || d.name || d.display_name?.split(",")[0] || "Unknown",
        subtitle: [d.address?.city, d.address?.state].filter(Boolean).join(", ") || d.display_name?.split(",").slice(1, 3).join(",").trim() || "",
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
        displayName: d.display_name || "",
      }));
  } catch {
    return [];
  }
}

// --- Station search via Nominatim ---
export async function searchStations(query: string): Promise<StationResult[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + " station")}&format=jsonv2&addressdetails=1&limit=5&viewbox=${GTA_VIEWBOX}&bounded=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    return (data as any[])
      .filter((d) =>
        d.class === "railway" ||
        d.class === "public_transport" ||
        d.type === "station" ||
        d.type === "halt" ||
        (d.display_name || "").toLowerCase().includes("station")
      )
      .slice(0, 3)
      .map((d) => ({
        type: "station" as const,
        osmId: String(d.osm_id),
        name: d.name || d.display_name?.split(",")[0] || "Station",
        subtitle: [d.address?.city, d.address?.state].filter(Boolean).join(", ") || "",
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
      }));
  } catch {
    return [];
  }
}

// --- Route search (local filter against live vehicles) ---
export function searchRoutes(query: string, vehicles: Vehicle[]): RouteResult[] {
  const q = query.toLowerCase();
  const seen = new Map<string, RouteResult>();

  vehicles.forEach((v) => {
    if (
      v.routeId.toLowerCase().includes(q) ||
      v.routeLabel.toLowerCase().includes(q)
    ) {
      const key = `${v.agency}-${v.routeId}`;
      if (seen.has(key)) {
        seen.get(key)!.vehicleCount++;
      } else {
        seen.set(key, {
          type: "route",
          routeId: v.routeId,
          routeLabel: v.routeLabel,
          agency: v.agency,
          vehicleCount: 1,
        });
      }
    }
  });

  return Array.from(seen.values()).slice(0, 5);
}

// --- Fetch route geometry from Overpass API ---
export interface RouteGeometry {
  coords: [number, number][];
  stops: { name: string; lat: number; lng: number }[];
}

export async function fetchRouteGeometry(routeRef: string): Promise<RouteGeometry | null> {
  try {
    const query = `[out:json];relation["type"="route"]["route"~"train|subway|tram|bus"]["ref"="${routeRef}"](43.2,-80.2,44.2,-78.5);out geom;`;
    const res = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
    );
    const data = await res.json();

    if (!data.elements?.length) return null;

    const relation = data.elements[0];
    const coords: [number, number][] = [];
    const stops: { name: string; lat: number; lng: number }[] = [];

    // Extract geometry from ways
    if (relation.members) {
      relation.members.forEach((m: any) => {
        if (m.type === "way" && m.geometry) {
          m.geometry.forEach((pt: any) => {
            coords.push([pt.lat, pt.lon]);
          });
        }
        if (m.type === "node" && m.role === "stop" && m.lat && m.lon) {
          stops.push({
            name: m.tags?.name || `Stop`,
            lat: m.lat,
            lng: m.lon,
          });
        }
      });
    }

    return { coords, stops };
  } catch {
    return null;
  }
}

// --- Station departures (mock) ---
export function getStationDepartures(stationName: string) {
  const q = stationName.toLowerCase();
  // Filter mock departures that could plausibly be at this station
  const departures = MOCK_DEPARTURES.filter((d) =>
    d.destination.toLowerCase().includes(q) ||
    d.routeLabel.toLowerCase().includes(q) ||
    q.includes("union") // Union Station has everything
  );
  return departures.length ? departures : MOCK_DEPARTURES.slice(0, 3);
}

// --- Station alerts (mock) ---
export function getStationAlerts(stationName: string) {
  const q = stationName.toLowerCase();
  return MOCK_ALERTS.filter((a) =>
    a.title.toLowerCase().includes(q) ||
    a.description.toLowerCase().includes(q) ||
    q.includes("union")
  );
}
