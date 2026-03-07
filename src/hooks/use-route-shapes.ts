import useSWR from "swr";
import { supabase } from "@/integrations/supabase/client";
import type { Agency } from "@/lib/types";

export interface RouteShape {
  agency_id: Agency;
  route_id: string;
  coords: [number, number][];
  route_color?: string | null;
  route_type?: number | null;
  route_long_name?: string | null;
}

/** Returns true if a route should use its own route_color instead of agency base color */
export function shouldUseRouteColor(shape: RouteShape): boolean {
  if (!shape.route_color) return false;
  // route_type 1 (subway) or 2 (rail)
  if (shape.route_type === 1 || shape.route_type === 2) return true;
  // All GO routes
  if (shape.agency_id === "GO") return true;
  // TTC lines (subway lines named "Line …")
  if (shape.agency_id === "TTC" && shape.route_long_name?.includes("Line")) return true;
  return false;
}

/** Resolve the display color for a route shape */
export function getRouteDisplayColor(shape: RouteShape, agencyColors: Record<string, string>): string {
  if (shouldUseRouteColor(shape)) {
    return `#${shape.route_color}`;
  }
  return `hsl(${agencyColors[shape.agency_id] || "0 0% 50%"})`;
}

async function fetchRouteShapes(): Promise<RouteShape[]> {
  const { data, error } = await supabase.functions.invoke("route-shapes");
  if (error) throw error;
  return (data as any[]).map((r) => ({
    agency_id: r.agency_id as Agency,
    route_id: r.route_id,
    coords: r.coords as [number, number][],
    route_color: r.route_color,
    route_type: r.route_type,
    route_long_name: r.route_long_name,
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
