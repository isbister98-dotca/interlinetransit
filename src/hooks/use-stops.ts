import useSWR from "swr";
import { supabase } from "@/integrations/supabase/client";
import type { Agency } from "@/lib/types";

export interface GtfsStop {
  stop_id: string;
  stop_name: string;
  stop_code: string | null;
  stop_lat: number;
  stop_lon: number;
  agency_id: Agency;
  wheelchair_boarding: number | null;
  location_type: number | null;
  parent_station: string | null;
}

async function fetchAllStops(): Promise<GtfsStop[]> {
  // Fetch all stops across agencies - parent stations and regular stops
  // Paginate since there may be >1000 stops
  const allStops: GtfsStop[] = [];
  let from = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from("gtfs_stops")
      .select("stop_id, stop_name, stop_code, stop_lat, stop_lon, agency_id, wheelchair_boarding, location_type, parent_station")
      .not("stop_lat", "is", null)
      .not("stop_lon", "is", null)
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allStops.push(
      ...data.map((s) => ({
        stop_id: s.stop_id,
        stop_name: s.stop_name || "Unknown Stop",
        stop_code: s.stop_code,
        stop_lat: s.stop_lat!,
        stop_lon: s.stop_lon!,
        agency_id: s.agency_id as Agency,
        wheelchair_boarding: s.wheelchair_boarding,
        location_type: s.location_type,
        parent_station: s.parent_station,
      }))
    );

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allStops;
}

export function useStops() {
  const { data, error, isLoading } = useSWR<GtfsStop[]>(
    "gtfs-stops",
    fetchAllStops,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 3600_000,
      fallbackData: [],
    }
  );

  return { stops: data ?? [], isLoading, error };
}

// ── Stop departures hook ──

export interface StopDeparture {
  tripId: string;
  routeId: string;
  routeShortName: string;
  routeLongName: string;
  routeColor: string | null;
  routeTextColor: string | null;
  routeType: number | null;
  headsign: string;
  scheduledDeparture: string;
  scheduledSeconds: number;
  stopSequence: number;
  wheelchairAccessible: boolean;
  liveDeparture: string | null;
  delaySeconds: number | null;
  isLive: boolean;
  isCancelled: boolean;
}

export interface StopAlert {
  id: string;
  header: string;
  description: string;
}

export interface StopRouteInfo {
  routeId: string;
  routeShortName: string;
  routeColor: string | null;
  routeTextColor: string | null;
}

export interface StopDepartureData {
  departures: StopDeparture[];
  alerts: StopAlert[];
  routes: StopRouteInfo[];
}

async function fetchStopDepartures(key: string): Promise<StopDepartureData> {
  const [, stopId, agencyId] = key.split("|");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const url = `https://${projectId}.supabase.co/functions/v1/stop-departures?stop_id=${encodeURIComponent(stopId)}&agency_id=${encodeURIComponent(agencyId)}&limit=15`;
  
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${anonKey}`,
      "apikey": anonKey,
    },
  });

  if (!res.ok) throw new Error(`Failed to fetch departures: ${res.status}`);
  return await res.json();
}

export function useStopDepartures(stopId: string | null, agencyId: string | null) {
  const key = stopId && agencyId ? `stop-departures|${stopId}|${agencyId}` : null;

  const { data, error, isLoading, mutate } = useSWR<StopDepartureData>(
    key,
    fetchStopDepartures,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: false,
      fallbackData: { departures: [], alerts: [], routes: [] },
    }
  );

  return {
    departures: data?.departures ?? [],
    alerts: data?.alerts ?? [],
    routes: data?.routes ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
}
