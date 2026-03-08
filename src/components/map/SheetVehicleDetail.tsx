import { Gauge, MapPin, Crosshair, Flag } from "lucide-react";
import { RouteChip } from "@/components/transit/RouteChip";
import { OccupancyBar } from "@/components/transit/OccupancyBar";
import { StatusPill } from "@/components/transit/StatusPill";
import type { Vehicle } from "@/lib/types";
import type { RouteGeometry } from "@/lib/osm-api";
import type { RouteShape } from "@/hooks/use-route-shapes";
import { AGENCY_COLORS } from "@/lib/types";

interface SheetVehicleDetailProps {
  vehicle: Vehicle;
  onTrack: () => void;
  routeGeometry: RouteGeometry | null;
  routeLoading: boolean;
  expanded: boolean;
  routeShape: RouteShape | null;
}

function bearingToDirection(bearing: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(bearing / 45) % 8];
}

function findNearestStopIndex(vehicle: Vehicle, stops: { lat: number; lng: number }[]): number {
  if (stops.length === 0) return -1;
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < stops.length; i++) {
    const d = Math.hypot(vehicle.lat - stops[i].lat, vehicle.lng - stops[i].lng);
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  }
  return minIdx;
}

export function SheetVehicleDetail({ vehicle, onTrack, routeGeometry, routeLoading, expanded, routeShape }: SheetVehicleDetailProps) {
  const isOnTime = (vehicle.speed || 0) > 10;
  const agencyColor = AGENCY_COLORS[vehicle.agency];
  const speedDisplay = vehicle.speed != null ? `${vehicle.speed} km/h` : "N/A";

  const stops = routeGeometry?.stops ?? [];
  const vehicleStopIdx = findNearestStopIndex(vehicle, stops);
  const destination = stops.length > 0 ? stops[stops.length - 1].name : bearingToDirection(vehicle.bearing);

  // Build display label: prefer destination, fallback to route_long_name
  const displayLabel = routeShape?.route_long_name
    ? `${vehicle.routeId} · ${routeShape.route_long_name}`
    : vehicle.routeLabel;

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <RouteChip
          routeId={vehicle.routeId}
          agency={vehicle.agency}
          routeColor={routeShape?.route_color}
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate">{displayLabel}</h3>
          <p className="text-[10px] text-muted-foreground">{vehicle.agency} · {vehicle.vehicleType}</p>
        </div>
        <StatusPill status={isOnTime ? "on-time" : "delayed"} delayMinutes={isOnTime ? undefined : 3} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="flex flex-col items-center gap-1 px-2 py-2 rounded-md bg-accent/50">
          <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-mono font-bold text-foreground">{speedDisplay}</span>
          <span className="text-[9px] text-muted-foreground">Speed</span>
        </div>
        <div className="flex flex-col items-center gap-1 px-2 py-2 rounded-md bg-accent/50">
          <Flag className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-mono font-bold text-foreground truncate max-w-[80px] text-center">{destination}</span>
          <span className="text-[9px] text-muted-foreground">Destination</span>
        </div>
        <div className="flex flex-col items-center gap-1 px-2 py-2 rounded-md bg-accent/50">
          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
          <OccupancyBar level={vehicle.occupancy || "LOW"} className="mt-0.5" />
          <span className="text-[9px] text-muted-foreground">Occupancy</span>
        </div>
      </div>

      {/* Track button */}
      <button
        onClick={onTrack}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:opacity-[0.88] transition-opacity mb-3"
      >
        <Crosshair className="w-3.5 h-3.5" />
        Track Vehicle
      </button>

      {/* Route stops timeline — only when expanded */}
      {expanded && (
        <div className="mt-1">
          {routeLoading && (
            <div className="text-xs text-muted-foreground text-center py-3">Loading route stops…</div>
          )}
          {!routeLoading && stops.length > 0 && (
            <div className="relative">
              {stops.map((stop, i) => {
                const isPassed = i < vehicleStopIdx;
                const isCurrent = i === vehicleStopIdx;
                const isUpcoming = i > vehicleStopIdx;

                return (
                  <div key={i} className="relative flex items-start">
                    {/* Vertical line + dot */}
                    <div className="flex flex-col items-center mr-3 shrink-0" style={{ width: 16 }}>
                      {/* Connecting line above */}
                      {i > 0 && (
                        <div
                          className="w-[3px] flex-none"
                          style={{
                            height: 12,
                            background: isPassed || isCurrent
                              ? `hsl(${agencyColor})`
                              : "hsl(var(--muted-foreground) / 0.25)",
                          }}
                        />
                      )}
                      {i === 0 && <div style={{ height: 12 }} />}
                      
                      {/* Dot / vehicle icon */}
                      {isCurrent ? (
                        <div
                          className="w-4 h-4 rounded-full border-[2.5px] flex items-center justify-center shrink-0"
                          style={{
                            borderColor: `hsl(${agencyColor})`,
                            background: `hsl(${agencyColor})`,
                          }}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-background" />
                        </div>
                      ) : (
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            background: isPassed
                              ? `hsl(${agencyColor})`
                              : "hsl(var(--muted-foreground) / 0.3)",
                          }}
                        />
                      )}

                      {/* Connecting line below */}
                      {i < stops.length - 1 && (
                        <div
                          className="w-[3px] flex-1 min-h-[20px]"
                          style={{
                            background: isPassed
                              ? `hsl(${agencyColor})`
                              : "hsl(var(--muted-foreground) / 0.25)",
                          }}
                        />
                      )}
                    </div>

                    {/* Stop info */}
                    <div className={`flex-1 min-w-0 pb-4 ${i === 0 ? "pt-2" : ""}`}>
                      <span
                        className={`text-xs truncate block ${
                          isCurrent
                            ? "font-bold text-foreground"
                            : isPassed
                              ? "text-muted-foreground"
                              : "text-foreground/80"
                        }`}
                      >
                        {stop.name}
                      </span>
                      {isCurrent && (
                        <span
                          className="text-[10px] font-semibold"
                          style={{ color: `hsl(${agencyColor})` }}
                        >
                          Vehicle is here
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!routeLoading && stops.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-3">No stop data available</div>
          )}
        </div>
      )}
    </div>
  );
}
