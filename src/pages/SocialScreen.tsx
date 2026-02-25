import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { MOCK_LEADERBOARD } from "@/lib/mock-data";
import { Trophy, ChevronRight, Train, Leaf, Flame, MapPin } from "lucide-react";

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

const USER_STATS = [
  { label: "Trips", value: "72", icon: Train },
  { label: "CO₂", value: "48 kg", icon: Leaf },
  { label: "Top Line", value: "LW", icon: MapPin },
  { label: "Streak", value: "12d", icon: Flame },
];

export default function SocialScreen() {
  const [metric, setMetric] = useState<Metric>("trips");
  const navigate = useNavigate();

  const podium = MOCK_LEADERBOARD.slice(0, 3);
  const rest = MOCK_LEADERBOARD.slice(3);
  const maxScore = MOCK_LEADERBOARD[0]?.score ?? 1;

  const podiumOrder = [podium[1], podium[0], podium[2]];

  return (
    <div className="max-w-[480px] mx-auto px-4 pt-6 pb-24 animate-fade-up overflow-y-auto scrollbar-hide">
      {/* Profile header — tappable, links to /profile */}
      <button
        onClick={() => navigate("/profile")}
        className="w-full flex items-center gap-3 mb-4 p-3 rounded-lg bg-card border border-border hover:bg-card-hover transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-[hsl(93_50%_56%/0.12)] border border-[hsl(93_50%_56%/0.28)] flex items-center justify-center text-sm font-bold text-primary">
          YU
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-foreground">Your Name</div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.06em]">View Profile</div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Stats strip */}
      <div className="flex items-center justify-between bg-card border border-border rounded-lg px-2 py-2.5 mb-5">
        {USER_STATS.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={cn(
              "flex-1 flex flex-col items-center gap-1",
              i < USER_STATS.length - 1 && "border-r border-border"
            )}>
              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-bold text-foreground">{stat.value}</span>
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.06em]">{stat.label}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-bold text-foreground">Leaderboard</h1>
        <span className="text-xs text-muted-foreground font-mono tracking-[0.06em] uppercase">Feb 2026</span>
      </div>
      <p className="text-xs text-muted-foreground mb-5">{MOCK_LEADERBOARD.length} riders</p>

      {/* Metric toggle */}
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
        {podiumOrder.map((entry) => {
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

      {/* Leaderboard list */}
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
