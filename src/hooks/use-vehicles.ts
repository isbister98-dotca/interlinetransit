import useSWR from "swr";
import { fetchAllVehicles } from "@/lib/transit-api";
import { MOCK_VEHICLES } from "@/lib/mock-data";
import type { Vehicle } from "@/lib/types";

export function useVehicles() {
  const { data, error, isLoading } = useSWR<Vehicle[]>(
    "vehicles",
    fetchAllVehicles,
    {
      refreshInterval: 15_000,
      fallbackData: MOCK_VEHICLES,
      revalidateOnFocus: false,
    }
  );

  return {
    vehicles: data ?? MOCK_VEHICLES,
    isLoading,
    error,
  };
}
