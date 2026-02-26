import { Activity, Users, Gauge, MapPin } from "lucide-react";
import { RouteChip } from "@/components/transit/RouteChip";
import { OccupancyBar } from "@/components/transit/OccupancyBar";
import type { RouteResult, RouteGeometry } from "@/lib/osm-api";
import type { Vehicle } from "@/lib/types";

interface SheetRouteDetailProps {
  route: RouteResult;
  vehicles: Vehicle[];
  geometry: RouteGeometry | null;
  loading: boolean;
}

export function SheetRouteDetail({ route, vehicles, geometry, loading }: SheetRouteDetailProps) {
  const routeVehicles = vehicles.filter(
    (v) => v.routeId === route.routeId && v.agency === route.agency
  );

  const avgSpeed = routeVehicles.length
    ? Math.round(routeVehicles.reduce((s, v) => s + (v.speed || 0), 0) / routeVehicles.length)
    : 0;

  const occupancies = routeVehicles.map((v) => v.occupancy).filter(Boolean);
  const avgOccupancy: "LOW" | "MEDIUM" | "HIGH" | "FULL" =
    occupancies.length === 0 ? "LOW"
    : occupancies.filter((o) => o === "HIGH" || o === "FULL").length > occupancies.length / 2 ? "HIGH"
    : occupancies.filter((o) => o === "MEDIUM" || o === "HIGH").length > occupancies.length / 2 ? "MEDIUM"
    : "LOW";

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-3 mb-4">
        <RouteChip routeId={route.routeId} agency={route.agency as any} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate">{route.routeLabel}</h3>
          <p className="text-[10px] text-muted-foreground">{route.agency} · {routeVehicles.length} active vehicles</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-4 px-3 py-2.5 rounded-md bg-accent/50">
        <div className="flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-mono font-bold text-foreground">{avgSpeed} km/h</span>
          <span className="text-[9px] text-muted-foreground">avg</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <OccupancyBar level={avgOccupancy} />
          <span className="text-[9px] text-muted-foreground capitalize">{avgOccupancy.toLowerCase()}</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-mono text-foreground">{routeVehicles.length}</span>
        </div>
      </div>

      {/* Stops */}
      {loading && (
        <div className="text-xs text-muted-foreground text-center py-3">Loading route data…</div>
      )}
      {geometry && geometry.stops.length > 0 && (
        <div>
          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Stops</h4>
          <div className="flex flex-col gap-1">
            {geometry.stops.slice(0, 15).map((s, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-xs text-foreground truncate">{s.name}</span>
              </div>
            ))}
            {geometry.stops.length > 15 && (
              <span className="text-[10px] text-muted-foreground pl-3.5">+{geometry.stops.length - 15} more stops</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
