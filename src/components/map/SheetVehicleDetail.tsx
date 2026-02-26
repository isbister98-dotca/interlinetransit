import { Compass, Gauge, MapPin, Clock, Crosshair } from "lucide-react";
import { RouteChip } from "@/components/transit/RouteChip";
import { OccupancyBar } from "@/components/transit/OccupancyBar";
import { StatusPill } from "@/components/transit/StatusPill";
import { Progress } from "@/components/ui/progress";
import type { Vehicle } from "@/lib/types";

interface SheetVehicleDetailProps {
  vehicle: Vehicle;
  onTrack: () => void;
}

function bearingToDirection(bearing: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(bearing / 45) % 8];
}

export function SheetVehicleDetail({ vehicle, onTrack }: SheetVehicleDetailProps) {
  // Simulated route progress (0-100)
  const routeProgress = Math.min(95, Math.max(5, ((vehicle.lat - 43.5) / 0.2) * 100));

  const isOnTime = (vehicle.speed || 0) > 10;

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <RouteChip routeId={vehicle.routeId} agency={vehicle.agency} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate">{vehicle.routeLabel}</h3>
          <p className="text-[10px] text-muted-foreground">{vehicle.agency} · {vehicle.vehicleType}</p>
        </div>
        <StatusPill status={isOnTime ? "on-time" : "delayed"} delayMinutes={isOnTime ? undefined : 3} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-md bg-accent/50">
          <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-mono font-bold text-foreground">{vehicle.speed ?? 0} km/h</span>
          <span className="text-[9px] text-muted-foreground">Speed</span>
        </div>
        <div className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-md bg-accent/50">
          <Compass className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-mono font-bold text-foreground">{bearingToDirection(vehicle.bearing)}</span>
          <span className="text-[9px] text-muted-foreground">Direction</span>
        </div>
        <div className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-md bg-accent/50">
          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
          <OccupancyBar level={vehicle.occupancy || "LOW"} className="mt-0.5" />
          <span className="text-[9px] text-muted-foreground">Occupancy</span>
        </div>
      </div>

      {/* Route progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Route Progress</span>
          <span className="text-[10px] font-mono text-muted-foreground">{Math.round(routeProgress)}%</span>
        </div>
        <Progress value={routeProgress} className="h-1.5 bg-accent" />
      </div>

      {/* Track button */}
      <button
        onClick={onTrack}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:opacity-[0.88] transition-opacity"
      >
        <Crosshair className="w-3.5 h-3.5" />
        Track Vehicle
      </button>
    </div>
  );
}
