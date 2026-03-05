import useSWR from "swr";
import { supabase } from "@/integrations/supabase/client";
import type { Agency } from "@/lib/types";

export interface RouteShape {
  agency_id: Agency;
  route_id: string;
  coords: [number, number][];
}

async function fetchRouteShapes(): Promise<RouteShape[]> {
  const { data, error } = await supabase.functions.invoke("route-shapes");
  if (error) throw error;
  return (data as any[]).map((r) => ({
    agency_id: r.agency_id as Agency,
    route_id: r.route_id,
    coords: r.coords as [number, number][],
  }));
}

export function useRouteShapes() {
  const { data, error, isLoading } = useSWR<RouteShape[]>(
    "route-shapes",
    fetchRouteShapes,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 3600_000, // 1 hour
      fallbackData: [],
    }
  );

  return { shapes: data ?? [], isLoading, error };
}
