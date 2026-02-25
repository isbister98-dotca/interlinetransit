import useSWR from "swr";
import { fetchAllVehicles } from "@/lib/transit-api";
import { MOCK_VEHICLES } from "@/lib/mock-data";
import type { Vehicle } from "@/lib/types";
import { useState, useEffect } from "react";

export function useVehicles() {
  // 3-second offset so client reads after server writes
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 3_000);
    return () => clearTimeout(t);
  }, []);

  const { data, error, isLoading } = useSWR<Vehicle[]>(
    ready ? "vehicles" : null,
    fetchAllVehicles,
    {
      refreshInterval: 15_000,
      fallbackData: MOCK_VEHICLES,
      revalidateOnFocus: false,
    }
  );

  return {
    vehicles: data ?? MOCK_VEHICLES,
    isLoading: !ready || isLoading,
    error,
  };
}
