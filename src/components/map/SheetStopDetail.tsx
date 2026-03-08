import { useState, useMemo } from "react";
import { Train, AlertTriangle, Accessibility, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { RouteChip } from "@/components/transit/RouteChip";
import { LivePill } from "@/components/transit/LivePill";
import { Skeleton } from "@/components/ui/skeleton";
import { useStopDepartures, type StopDeparture, type StopAlert } from "@/hooks/use-stops";
import type { GtfsStop } from "@/hooks/use-stops";
import type { Agency } from "@/lib/types";

interface SheetStopDetailProps {
  stop: GtfsStop;
}

function getCountdown(dep: StopDeparture): { text: string; isNow: boolean } {
  const depSeconds = dep.isLive && dep.delaySeconds != null
    ? dep.scheduledSeconds + dep.delaySeconds
    : dep.scheduledSeconds;

  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/Toronto" }));
  const nowSeconds = et.getHours() * 3600 + et.getMinutes() * 60 + et.getSeconds();
  const diffMin = Math.round((depSeconds - nowSeconds) / 60);

  if (diffMin <= 0) return { text: "Due", isNow: true };
  if (diffMin === 1) return { text: "1 min", isNow: false };
  if (diffMin < 60) return { text: `${diffMin} min`, isNow: false };
  // Show time instead
  const h = Math.floor(depSeconds / 3600) % 24;
  const m = Math.floor((depSeconds % 3600) / 60);
  return { text: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, isNow: false };
}

export function SheetStopDetail({ stop }: SheetStopDetailProps) {
  const { departures, alerts, routes, isLoading } = useStopDepartures(stop.stop_id, stop.agency_id);
  const [activeRouteFilter, setActiveRouteFilter] = useState<string | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const filteredDepartures = useMemo(() => {
    if (!activeRouteFilter) return departures;
    return departures.filter((d) => d.routeId === activeRouteFilter);
  }, [departures, activeRouteFilter]);

  // Group departures: "Now" (≤5 min), "Later today"
  const { nowDeps, laterDeps } = useMemo(() => {
    const now: StopDeparture[] = [];
    const later: StopDeparture[] = [];
    for (const d of filteredDepartures) {
      const { isNow, text } = getCountdown(d);
      const numMin = parseInt(text);
      if (isNow || (!isNaN(numMin) && numMin <= 5)) {
        now.push(d);
      } else {
        later.push(d);
      }
    }
    return { nowDeps: now, laterDeps: later };
  }, [filteredDepartures]);

  const isWheelchairAccessible = stop.wheelchair_boarding === 1;
  const visibleAlerts = alerts.filter((a) => !dismissedAlerts.has(a.id));

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <Train className="w-4.5 h-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground truncate">{stop.stop_name}</h3>
            {isWheelchairAccessible && (
              <Accessibility className="w-3.5 h-3.5 text-info shrink-0" />
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">{stop.agency_id} · Stop {stop.stop_code || stop.stop_id}</p>
        </div>
        <LivePill />
      </div>

      {/* Route filter bar */}
      {routes.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-3 pb-1">
          <button
            onClick={() => setActiveRouteFilter(null)}
            className={cn(
              "px-2.5 py-1 rounded-sm text-[11px] font-mono font-bold whitespace-nowrap transition-all",
              !activeRouteFilter
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
          {routes.map((r) => (
            <button
              key={r.routeId}
              onClick={() => setActiveRouteFilter(activeRouteFilter === r.routeId ? null : r.routeId)}
              className={cn(
                "transition-all rounded-sm",
                activeRouteFilter === r.routeId && "ring-2 ring-primary ring-offset-1 ring-offset-background"
              )}
            >
              <RouteChip
                routeId={r.routeShortName}
                agency={stop.agency_id}
                size="xs"
                routeColor={r.routeColor}
                routeTextColor={r.routeTextColor}
              />
            </button>
          ))}
        </div>
      )}

      {/* Alert banners */}
      {visibleAlerts.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-2 px-3 py-2 rounded-md bg-warning/10 border border-warning/20 mb-3"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-semibold text-foreground">{a.header}</span>
            {a.description && (
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>
            )}
          </div>
          <button
            onClick={() => setDismissedAlerts((prev) => new Set(prev).add(a.id))}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-[30px] h-[30px] rounded-md" />
              <div className="flex-1">
                <Skeleton className="h-3 w-3/4 mb-1.5" />
                <Skeleton className="h-2 w-1/2" />
              </div>
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
      )}

      {/* Departures */}
      {!isLoading && filteredDepartures.length > 0 && (
        <>
          {nowDeps.length > 0 && (
            <>
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Now</h4>
              <div className="flex flex-col mb-3">
                {nowDeps.map((d, i) => (
                  <DepartureItem key={`${d.tripId}-${i}`} departure={d} agency={stop.agency_id} />
                ))}
              </div>
            </>
          )}

          {laterDeps.length > 0 && (
            <>
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Later Today</h4>
              <div className="flex flex-col">
                {laterDeps.map((d, i) => (
                  <DepartureItem key={`${d.tripId}-${i}`} departure={d} agency={stop.agency_id} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Empty state */}
      {!isLoading && filteredDepartures.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Clock className="w-8 h-8 text-muted-foreground/50 mb-2" />
          <p className="text-xs font-semibold text-muted-foreground">No upcoming departures</p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            {activeRouteFilter ? "Try removing the route filter" : "Check back later for scheduled service"}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Individual departure row ──

function DepartureItem({ departure, agency }: { departure: StopDeparture; agency: Agency }) {
  const { text: countdown, isNow } = getCountdown(departure);
  const delayMin = departure.delaySeconds != null ? Math.round(departure.delaySeconds / 60) : 0;
  const isDelayed = delayMin > 1;
  const isOnTime = departure.isLive && !isDelayed;

  return (
    <div className={cn(
      "flex items-center gap-3 py-2.5 border-b border-[rgba(255,255,255,0.07)] last:border-none",
      departure.isCancelled && "opacity-50"
    )}>
      <RouteChip
        routeId={departure.routeShortName}
        agency={agency}
        size="sm"
        routeColor={departure.routeColor}
        routeTextColor={departure.routeTextColor}
      />

      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-[13px] font-semibold text-foreground truncate",
          departure.isCancelled && "line-through"
        )}>
          {departure.headsign}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {departure.wheelchairAccessible && (
            <Accessibility className="w-3 h-3 text-info" />
          )}
          <span className="font-mono text-[9px] text-muted-foreground tracking-[0.06em] uppercase">
            {departure.scheduledDeparture?.slice(0, 5)}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        {departure.isCancelled ? (
          <span className="font-mono text-xs font-semibold text-destructive">Cancelled</span>
        ) : (
          <span className={cn(
            "font-mono text-lg font-medium leading-none",
            isNow ? "text-warning" : isDelayed ? "text-destructive" : "text-success"
          )}>
            {countdown}
          </span>
        )}
        <span className={cn(
          "text-[9px] font-mono font-semibold uppercase tracking-wider",
          departure.isLive
            ? isDelayed ? "text-destructive" : "text-success"
            : "text-muted-foreground"
        )}>
          {departure.isCancelled ? "" : departure.isLive ? (isDelayed ? `+${delayMin}m` : "Live") : "Scheduled"}
        </span>
      </div>
    </div>
  );
}
