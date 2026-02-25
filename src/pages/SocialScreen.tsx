import { useState } from "react";
import { cn } from "@/lib/utils";
import { MOCK_LEADERBOARD } from "@/lib/mock-data";
import { Trophy } from "lucide-react";

type Metric = "trips" | "co2" | "routes";

const METRIC_LABELS: Record<Metric, string> = {
  trips: "Trips",
  co2: "CO₂ Saved",
  routes: "Routes",
};

const METRIC_UNITS: Record<Metric, string> = {
  trips: "trips",
  co2: "kg",
  routes: "lines",
};

export default function SocialScreen() {
  const [metric, setMetric] = useState<Metric>("trips");

  const podium = MOCK_LEADERBOARD.slice(0, 3);
  const rest = MOCK_LEADERBOARD.slice(3);
  const maxScore = MOCK_LEADERBOARD[0]?.score ?? 1;

  // Reorder podium: 2nd, 1st, 3rd
  const podiumOrder = [podium[1], podium[0], podium[2]];

  return (
    <div className="max-w-[480px] mx-auto px-4 pt-6 pb-24 animate-fade-up overflow-y-auto scrollbar-hide">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-bold text-foreground">Social Hub</h1>
        <span className="text-xs text-muted-foreground font-mono tracking-[0.06em] uppercase">Feb 2026</span>
      </div>
      <p className="text-xs text-muted-foreground mb-5">{MOCK_LEADERBOARD.length} riders</p>

      {/* Metric toggle — brand guide toggle-wrap style */}
      <div className="flex bg-[rgba(0,0,0,0.45)] border border-border rounded-full p-[3px] gap-[2px] mb-6">
        {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={cn(
              "flex-1 py-[7px] text-[13px] font-semibold rounded-full transition-all",
              metric === m ? "bg-foreground text-background" : "text-muted-foreground"
            )}
          >
            {METRIC_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Podium */}
      <div className="flex items-end justify-center gap-3 mb-8">
        {podiumOrder.map((entry, i) => {
          if (!entry) return null;
          const isFirst = entry.rank === 1;
          return (
            <div key={entry.rank} className="flex flex-col items-center">
              <div
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold mb-2",
                  isFirst
                    ? "bg-[hsl(93_50%_56%/0.12)] text-primary border-2 border-[hsl(93_50%_56%/0.28)] shadow-[0_0_16px_hsla(93,50%,56%,0.3)]"
                    : "bg-accent text-muted-foreground border border-border"
                )}
              >
                {entry.initials}
              </div>
              {isFirst && <Trophy className="w-4 h-4 text-primary mb-1" />}
              <span className={cn("text-xs font-semibold", isFirst ? "text-primary" : "text-foreground")}>{entry.name}</span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {entry.score} {METRIC_UNITS[metric]}
              </span>
              <div
                className={cn(
                  "w-16 mt-2 rounded-t-lg",
                  isFirst ? "bg-[hsl(93_50%_56%/0.12)] h-20" : entry.rank === 2 ? "bg-accent h-14" : "bg-accent h-10"
                )}
              />
            </div>
          );
        })}
      </div>

      {/* Leaderboard */}
      <div className="flex flex-col">
        {rest.map((entry) => (
          <div
            key={entry.rank}
            className={cn(
              "flex items-center gap-2.5 py-[9px] border-b border-[rgba(255,255,255,0.07)] last:border-none",
              entry.isYou && "bg-[hsl(93_50%_56%/0.12)] rounded-md px-2 -mx-2 border-[hsl(93_50%_56%/0.28)]"
            )}
          >
            <span className="font-mono text-xs font-bold text-muted-foreground w-5 text-center">{entry.rank}</span>
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-muted-foreground">
              {entry.initials}
            </div>
            <span className={cn("flex-1 text-sm font-semibold", entry.isYou ? "text-primary" : "text-foreground")}>
              {entry.name}
            </span>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 rounded-full bg-[rgba(255,255,255,0.07)] overflow-hidden">
                <div
                  className={cn("h-full rounded-full", entry.isYou ? "bg-primary" : "bg-muted-foreground/40")}
                  style={{ width: `${(entry.score / maxScore) * 100}%` }}
                />
              </div>
              <span className="text-xs font-mono text-muted-foreground w-12 text-right">
                {entry.score} {METRIC_UNITS[metric]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
