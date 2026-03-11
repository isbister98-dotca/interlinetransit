import { Bike, Zap, X } from "lucide-react";
import type { BikeStation } from "@/hooks/use-bike-stations";

interface SheetBikeStationDetailProps {
  station: BikeStation;
  onClose: () => void;
}

export function SheetBikeStationDetail({ station, onClose }: SheetBikeStationDetailProps) {
  const totalBikes = station.num_bikes_available;
  const hasBikes = totalBikes > 0;

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <Bike className="w-4.5 h-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate">{station.name}</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-muted-foreground">Bike Share Toronto</span>
            {station.is_charging_station && (
              <span className="flex items-center gap-0.5 text-[10px] text-warning">
                <Zap className="w-3 h-3" />
                Charging
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-accent transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-border mb-5">
        <div className="text-center px-2">
          <div className="text-2xl font-bold font-mono text-foreground">{station.num_ebikes_available}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">e-bikes</div>
        </div>
        <div className="text-center px-2">
          <div className="text-2xl font-bold font-mono text-foreground">{station.num_mechanical_available}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Classic</div>
        </div>
        <div className="text-center px-2">
          <div className="text-2xl font-bold font-mono text-foreground">{station.num_docks_available}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">open docks</div>
        </div>
      </div>

      {/* Capacity bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Station Capacity</span>
          <span className="text-[10px] font-mono text-muted-foreground">{totalBikes}/{station.capacity}</span>
        </div>
        <div className="h-2 rounded-full bg-accent overflow-hidden flex">
          {station.num_ebikes_available > 0 && (
            <div
              className="h-full bg-warning transition-all"
              style={{ width: `${(station.num_ebikes_available / station.capacity) * 100}%` }}
            />
          )}
          {station.num_mechanical_available > 0 && (
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(station.num_mechanical_available / station.capacity) * 100}%` }}
            />
          )}
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-warning" />
            <span className="text-[9px] text-muted-foreground">e-bike</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[9px] text-muted-foreground">Classic</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-[9px] text-muted-foreground">Empty</span>
          </div>
        </div>
      </div>

      {/* Status pill */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${hasBikes ? "bg-success" : "bg-destructive"}`} />
        <span className="text-xs text-muted-foreground">
          {hasBikes ? `${totalBikes} bike${totalBikes !== 1 ? "s" : ""} available` : "No bikes available"}
        </span>
      </div>
    </div>
  );
}
