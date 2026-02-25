import useSWR from "swr";
import { fetchAllVehicles } from "@/lib/transit-api";
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
      fallbackData: [],
      revalidateOnFocus: false,
    }
  );

  const filtered = (data ?? []).filter(
    (v) => v.routeId && v.routeId !== "?" && v.routeLabel && v.routeLabel !== "?"
  );

  return {
    vehicles: filtered,
    isLoading: !ready || isLoading,
    error,
  };
}
