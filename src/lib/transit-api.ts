import { supabase } from "@/integrations/supabase/client";
import type { Vehicle } from "./types";

const STALE_THRESHOLD_MS = 45_000; // 45 seconds

export async function fetchAllVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicle_cache")
    .select("vehicles, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    console.warn("vehicle_cache read failed:", error);
    return [];
  }

  const age = Date.now() - new Date(data.updated_at).getTime();
  if (age > STALE_THRESHOLD_MS) {
    console.warn(`Cache stale (${Math.round(age / 1000)}s old)`);
  }

  return (data.vehicles as unknown as Vehicle[]) ?? [];
}
