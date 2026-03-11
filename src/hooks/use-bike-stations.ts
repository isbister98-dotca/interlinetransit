import useSWR from "swr";

export interface BikeStation {
  station_id: string;
  name: string;
  lat: number;
  lon: number;
  capacity: number;
  is_charging_station: boolean;
  // Status fields (merged)
  num_bikes_available: number;
  num_docks_available: number;
  num_ebikes_available: number;
  num_mechanical_available: number;
}

interface StationInfo {
  station_id: string;
  name: string;
  lat: number;
  lon: number;
  capacity: number;
  is_charging_station: boolean;
}

interface StationStatus {
  station_id: string;
  num_bikes_available: number;
  num_docks_available: number;
  num_bikes_available_types?: {
    mechanical?: number;
    ebike?: number;
  };
}

async function fetchBikeStations(): Promise<BikeStation[]> {
  const [infoRes, statusRes] = await Promise.all([
    fetch("https://tor.publicbikesystem.net/ube/gbfs/v1/en/station_information"),
    fetch("https://tor.publicbikesystem.net/ube/gbfs/v1/en/station_status"),
  ]);

  const infoData = await infoRes.json();
  const statusData = await statusRes.json();

  const stations: StationInfo[] = infoData?.data?.stations ?? [];
  const statuses: StationStatus[] = statusData?.data?.stations ?? [];

  const statusMap = new Map<string, StationStatus>();
  statuses.forEach((s) => statusMap.set(s.station_id, s));

  return stations.map((info) => {
    const status = statusMap.get(info.station_id);
    return {
      station_id: info.station_id,
      name: info.name,
      lat: info.lat,
      lon: info.lon,
      capacity: info.capacity,
      is_charging_station: info.is_charging_station ?? false,
      num_bikes_available: status?.num_bikes_available ?? 0,
      num_docks_available: status?.num_docks_available ?? 0,
      num_ebikes_available: status?.num_bikes_available_types?.ebike ?? 0,
      num_mechanical_available: status?.num_bikes_available_types?.mechanical ?? 0,
    };
  });
}

export function useBikeStations() {
  const { data, error, isLoading } = useSWR<BikeStation[]>(
    "bike-stations",
    fetchBikeStations,
    {
    refreshInterval: 300_000, // 5 min
    fallbackData: [],
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    }
  );

  return {
    stations: data ?? [],
    isLoading,
    error,
  };
}
