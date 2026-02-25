import { useState } from "react";
import { ArrowDownUp, Search, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { RouteChip } from "@/components/transit/RouteChip";
import { MOCK_JOURNEY_RESULTS } from "@/lib/mock-data";
import type { JourneyResult } from "@/lib/types";

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function JourneyTimeline({ stops }: { stops: JourneyResult["stops"] }) {
  return (
    <div className="relative ml-3 mt-3 border-l-2 border-primary/30 pl-4 space-y-3">
      {stops.map((stop, i) => (
        <div key={i} className="relative flex items-center gap-2">
          <div
            className={cn(
              "absolute -left-[calc(1rem+5px)] w-2.5 h-2.5 rounded-full border-2",
              stop.isCurrent
                ? "bg-primary border-primary shadow-[0_0_8px_hsla(82,85%,55%,0.6)]"
                : stop.isTransfer
                  ? "bg-warning border-warning"
                  : "bg-surface-3 border-muted-foreground/40"
            )}
          />
          <span className="text-xs font-mono text-muted-foreground w-12">{formatTime(stop.time)}</span>
          <span className={cn("text-sm", stop.isCurrent ? "text-primary font-semibold" : "text-foreground")}>
            {stop.name}
          </span>
          {stop.isTransfer && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning font-mono">Transfer</span>
          )}
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

  return (
    <div className="max-w-[480px] mx-auto px-4 pt-6 pb-24 animate-fade-up">
      <h1 className="text-lg font-semibold text-foreground mb-4">Plan Journey</h1>

      {/* Search inputs */}
      <div className="relative flex flex-col gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="From"
            className="w-full bg-surface-1 text-foreground text-sm rounded-xl pl-9 pr-3 py-3 border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
          />
        </div>

        <button
          onClick={swap}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-surface-2 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowDownUp className="w-3.5 h-3.5" />
        </button>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="To"
            className="w-full bg-surface-1 text-foreground text-sm rounded-xl pl-9 pr-3 py-3 border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Date/time */}
      <div className="flex items-center gap-2 mb-4">
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-1 border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Clock className="w-3.5 h-3.5" />
          Depart now
        </button>
      </div>

      {/* Find routes button */}
      <button
        onClick={() => setShowResults(true)}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors mb-6"
      >
        Find Routes
      </button>

      {/* Results */}
      {showResults && (
        <div className="space-y-3">
          {MOCK_JOURNEY_RESULTS.map((j) => (
            <div
              key={j.id}
              className="bg-surface-1 rounded-xl border border-border p-3 cursor-pointer hover:bg-surface-2 transition-colors"
              onClick={() => setExpandedJourney(expandedJourney === j.id ? null : j.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  {j.routes.map((r, i) => (
                    <RouteChip key={i} routeId={r.routeLabel} agency={r.agency} />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">{j.transfers} transfer{j.transfers !== 1 && "s"}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-mono">
                  <span className="text-foreground">{formatTime(j.departureTime)}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-foreground">{formatTime(j.arrivalTime)}</span>
                </div>
                <span className="text-sm font-semibold text-primary">{j.durationMinutes} min</span>
              </div>

              {expandedJourney === j.id && <JourneyTimeline stops={j.stops} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
