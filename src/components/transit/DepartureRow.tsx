import { cn } from "@/lib/utils";
import { RouteChip } from "./RouteChip";
import { StatusPill } from "./StatusPill";
import { OccupancyBar } from "./OccupancyBar";
import type { Departure } from "@/lib/types";

interface DepartureRowProps {
  departure: Departure;
  className?: string;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function minutesUntil(date: Date) {
  const diff = Math.round((date.getTime() - Date.now()) / 60_000);
  if (diff <= 0) return "Now";
  if (diff === 1) return "1 min";
  return `${diff} min`;
}

export function DepartureRow({ departure, className }: DepartureRowProps) {
  const status = departure.delayMinutes > 0 ? "delayed" : "on-time";

  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-1 hover:bg-surface-2 transition-colors", className)}>
      <RouteChip routeId={departure.routeId} agency={departure.agency} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{departure.destination}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-mono text-muted-foreground">{formatTime(departure.departureTime)}</span>
          {departure.platform && (
            <span className="text-[10px] text-muted-foreground">P{departure.platform}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-mono font-semibold text-primary">{minutesUntil(departure.departureTime)}</span>
        <div className="flex items-center gap-2">
          <StatusPill status={status} delayMinutes={departure.delayMinutes} />
          {departure.occupancy && <OccupancyBar level={departure.occupancy} />}
        </div>
      </div>
    </div>
  );
}
