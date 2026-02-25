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
  const mins = minutesUntil(departure.departureTime);

  return (
    <div className={cn(
      "flex items-center gap-3.5 py-3 border-b border-[rgba(255,255,255,0.07)] last:border-none",
      className
    )}>
      <RouteChip routeId={departure.routeId} agency={departure.agency} size="sm" />

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground truncate">{departure.destination}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-mono text-[9px] text-muted-foreground tracking-[0.06em] uppercase">
            {departure.platform ? `Platform ${departure.platform}` : formatTime(departure.departureTime)}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <span className={cn(
          "font-mono text-lg font-medium leading-none",
          status === "on-time" ? "text-success" : "text-destructive"
        )}>
          {mins}
        </span>
        <div className="flex items-center gap-2">
          <StatusPill status={status} delayMinutes={departure.delayMinutes} />
          {departure.occupancy && <OccupancyBar level={departure.occupancy} />}
        </div>
      </div>
    </div>
  );
}
