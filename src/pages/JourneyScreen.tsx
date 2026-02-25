import { useState } from "react";
import { ArrowDownUp, Search, Clock, AlertTriangle, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RouteChip } from "@/components/transit/RouteChip";
import { MOCK_JOURNEY_RESULTS, MOCK_ALERTS } from "@/lib/mock-data";
import type { JourneyResult } from "@/lib/types";

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false });
}

const SEVERITY_STYLES = {
  disruption: { border: "border-l-destructive", icon: AlertTriangle, iconColor: "text-destructive" },
  warning: { border: "border-l-warning", icon: AlertCircle, iconColor: "text-warning" },
  info: { border: "border-l-info", icon: Info, iconColor: "text-info" },
};

function JourneyTimeline({ stops }: { stops: JourneyResult["stops"] }) {
  return (
    <div className="relative ml-6 mt-3 pl-4 space-y-0">
      {/* Vertical track line */}
      <div className="absolute left-0 top-[10px] bottom-[10px] w-0.5 bg-border" />
      {stops.map((stop, i) => (
        <div key={i} className="relative flex items-center gap-3.5 py-[11px]">
          <div
            className={cn(
              "absolute left-[-24px] w-3 h-3 flex-shrink-0",
              stop.isCurrent
                ? "bg-primary border-2 border-primary"
                : stop.isTransfer
                  ? "bg-primary border-2 border-primary"
                  : "bg-background border-2 border-border"
            )}
            style={{ borderRadius: 0 }}
          />
          <span className={cn(
            "font-mono text-xs text-muted-foreground ml-auto w-14 text-right whitespace-nowrap",
            stop.isCurrent && "text-primary font-semibold"
          )}>
            {formatTime(stop.time)}
          </span>
          <div className="flex-1">
            <span className={cn(
              "text-sm font-medium",
              stop.isCurrent ? "text-primary font-bold" : "text-foreground"
            )}>
              {stop.name}
            </span>
            {stop.isTransfer && (
              <div className="font-mono text-[9px] text-primary tracking-[0.04em] uppercase mt-0.5">
                Transfer
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function JourneyScreen() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showResults, setShowResults] = useState(true);
  const [expandedJourney, setExpandedJourney] = useState<string | null>(null);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const hasAlerts = MOCK_ALERTS.length > 0;

  return (
    <div className="max-w-[480px] mx-auto px-4 pt-6 pb-24 animate-fade-up overflow-y-auto scrollbar-hide">
      <h1 className="text-lg font-bold text-foreground mb-4">Plan Journey</h1>

      {/* Search inputs */}
      <div className="relative flex flex-col gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--text-tertiary))]" />
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="From"
            className="w-full bg-input text-foreground text-sm rounded-md pl-10 pr-3 py-3 border-[1.5px] border-border focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(142,203,90,0.10)] placeholder:text-[hsl(var(--text-tertiary))] transition-all"
          />
        </div>

        <button
          onClick={swap}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-md bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowDownUp className="w-3.5 h-3.5" />
        </button>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--text-tertiary))]" />
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="To"
            className="w-full bg-input text-foreground text-sm rounded-md pl-10 pr-3 py-3 border-[1.5px] border-border focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(142,203,90,0.10)] placeholder:text-[hsl(var(--text-tertiary))] transition-all"
          />
        </div>
      </div>

      {/* Date/time */}
      <div className="flex items-center gap-2 mb-4">
        <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-md bg-transparent border-[1.5px] border-[rgba(255,255,255,0.20)] text-sm text-foreground font-semibold hover:bg-card transition-colors">
          <Clock className="w-3.5 h-3.5" />
          Depart now
        </button>
      </div>

      {/* Find routes button */}
      <button
        onClick={() => setShowResults(true)}
        className="w-full py-3.5 rounded-md bg-primary text-primary-foreground font-bold text-[15px] hover:opacity-[0.88] transition-opacity mb-6"
      >
        Find Routes
      </button>

      {/* Results */}
      {showResults && (
        <div className="space-y-3">
          {MOCK_JOURNEY_RESULTS.map((j) => (
            <div
              key={j.id}
              className="bg-card rounded-lg border border-[rgba(255,255,255,0.07)] p-4 cursor-pointer hover:bg-card-hover transition-colors"
              onClick={() => setExpandedJourney(expandedJourney === j.id ? null : j.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  {j.routes.map((r, i) => (
                    <RouteChip key={i} routeId={r.routeId} routeLabel={r.routeLabel} agency={r.agency} size="xs" />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground font-mono">{j.transfers} transfer{j.transfers !== 1 && "s"}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-sm">
                  <span className="text-foreground">{formatTime(j.departureTime)}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-foreground">{formatTime(j.arrivalTime)}</span>
                </div>
                <span className="text-sm font-semibold text-primary font-mono">{j.durationMinutes} min</span>
              </div>

              {expandedJourney === j.id && <JourneyTimeline stops={j.stops} />}
            </div>
          ))}
        </div>
      )}

      {/* Service Alerts */}
      <div className="mt-8 pt-6 border-t border-border">
        <h2 className="text-sm font-bold text-foreground mb-3">Service Alerts</h2>

        {!hasAlerts ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-success mb-3" />
            <p className="text-sm text-muted-foreground">All services running normally</p>
          </div>
        ) : (
          <div className="space-y-3">
            {MOCK_ALERTS.map((alert) => {
              const style = SEVERITY_STYLES[alert.severity];
              const Icon = style.icon;
              return (
                <div key={alert.id} className={cn(
                  "bg-card border border-[rgba(255,255,255,0.07)] border-l-[3px] rounded-md p-3.5",
                  style.border
                )}>
                  <div className="flex items-start gap-3">
                    <Icon className={cn("w-[18px] h-[18px] mt-0.5 shrink-0", style.iconColor)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-foreground mb-1">{alert.title}</div>
                      <div className="flex items-center gap-1.5 mb-2">
                        {alert.affectedRoutes.map((r) => (
                          <RouteChip key={r} routeId={r} agency={alert.agency} size="xs" />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{alert.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
