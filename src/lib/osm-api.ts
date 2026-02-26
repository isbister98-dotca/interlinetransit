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

// Map agency to OSM route types for better matching
const AGENCY_ROUTE_TYPES: Record<string, string[]> = {
  GO: ["train", "bus"],
  UP: ["train"],
  TTC: ["subway", "tram", "bus"],
  MiWay: ["bus"],
};

export async function fetchRouteGeometry(routeRef: string, agency?: string): Promise<RouteGeometry | null> {
  try {
    const query = `[out:json];relation["type"="route"]["route"~"train|subway|tram|bus"]["ref"="${routeRef}"](43.2,-80.2,44.2,-78.5);out geom;`;
    const res = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
    );
    const data = await res.json();

    if (!data.elements?.length) return null;

    // Pick the best relation matching the agency
    let relation = data.elements[0];
    if (agency && data.elements.length > 1) {
      const preferred = AGENCY_ROUTE_TYPES[agency] || [];
      const agencyLower = agency.toLowerCase();
      
      // Score each relation by how well it matches the agency
      const scored = data.elements.map((el: any) => {
        let score = 0;
        const operator = (el.tags?.operator || el.tags?.network || "").toLowerCase();
        const routeType = el.tags?.route || "";
        
        // Operator/network name match
        if (operator.includes(agencyLower) || operator.includes("go transit") && agency === "GO") score += 10;
        if (operator.includes("ttc") && agency === "TTC") score += 10;
        if (operator.includes("miway") && agency === "MiWay") score += 10;
        if (operator.includes("up express") && agency === "UP") score += 10;
        
        // Route type match
        if (preferred.includes(routeType)) score += 5;
        
        // Prefer relations with more geometry (more complete)
        const memberCount = el.members?.filter((m: any) => m.type === "way" && m.geometry).length || 0;
        score += Math.min(memberCount, 5);
        
        return { el, score };
      });
      
      scored.sort((a: any, b: any) => b.score - a.score);
      relation = scored[0].el;
    }

    const stops: { name: string; lat: number; lng: number }[] = [];
    const waySegments: [number, number][][] = [];

    // Extract geometry from ways as ordered segments
    if (relation.members) {
      relation.members.forEach((m: any) => {
        if (m.type === "way" && m.geometry && m.geometry.length > 0) {
          const segment: [number, number][] = m.geometry.map((pt: any) => [pt.lat, pt.lon]);
          waySegments.push(segment);
        }
        if (m.type === "node" && (m.role === "stop" || m.role === "stop_entry_only" || m.role === "stop_exit_only") && m.lat && m.lon) {
          const name = m.tags?.name || "Stop";
          // Deduplicate stops by name
          if (!stops.find(s => s.name === name && Math.abs(s.lat - m.lat) < 0.001)) {
            stops.push({ name, lat: m.lat, lng: m.lon });
          }
        }
      });
    }

    // Order segments into a continuous line by connecting endpoints
    const coords = orderSegments(waySegments);

    return { coords, stops };
  } catch {
    return null;
  }
}

/** Connect way segments into a continuous ordered line */
function orderSegments(segments: [number, number][][]): [number, number][] {
  if (segments.length === 0) return [];
  if (segments.length === 1) return segments[0];

  const used = new Set<number>();
  const result: [number, number][] = [...segments[0]];
  used.add(0);

  for (let iter = 1; iter < segments.length; iter++) {
    let bestIdx = -1;
    let bestDist = Infinity;
    let flipBest = false;
    let prependBest = false;

    const tailPt = result[result.length - 1];
    const headPt = result[0];

    for (let i = 0; i < segments.length; i++) {
      if (used.has(i)) continue;
      const seg = segments[i];
      const segStart = seg[0];
      const segEnd = seg[seg.length - 1];

      // Try appending (normal or flipped)
      const d1 = dist(tailPt, segStart);
      const d2 = dist(tailPt, segEnd);
      // Try prepending (normal or flipped)
      const d3 = dist(headPt, segEnd);
      const d4 = dist(headPt, segStart);

      if (d1 < bestDist) { bestDist = d1; bestIdx = i; flipBest = false; prependBest = false; }
      if (d2 < bestDist) { bestDist = d2; bestIdx = i; flipBest = true; prependBest = false; }
      if (d3 < bestDist) { bestDist = d3; bestIdx = i; flipBest = false; prependBest = true; }
      if (d4 < bestDist) { bestDist = d4; bestIdx = i; flipBest = true; prependBest = true; }
    }

    if (bestIdx === -1) break;
    used.add(bestIdx);

    let seg = segments[bestIdx];
    if (flipBest) seg = [...seg].reverse();

    if (prependBest) {
      result.unshift(...seg);
    } else {
      result.push(...seg);
    }
  }

  return result;
}

function dist(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
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
