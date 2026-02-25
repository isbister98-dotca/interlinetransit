import { Train, Leaf, Flame, MapPin, Bell, Settings, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RouteChip } from "@/components/transit/RouteChip";

const STATS = [
  { label: "Total Trips", value: "72", icon: Train },
  { label: "CO₂ Saved", value: "48 kg", icon: Leaf },
  { label: "Favourite", value: "LW", icon: MapPin },
  { label: "Streak", value: "12 days", icon: Flame },
];

const FAVOURITE_ROUTES = [
  { routeId: "LW", routeLabel: "Lakeshore West", agency: "GO" as const },
  { routeId: "1", routeLabel: "Line 1", agency: "TTC" as const },
  { routeId: "UP", routeLabel: "UP Express", agency: "UP" as const },
];

const SETTINGS_ITEMS = [
  { label: "Notifications", icon: Bell },
  { label: "Home Stop", icon: MapPin },
  { label: "Settings", icon: Settings },
];

export default function ProfileScreen() {
  return (
    <div className="max-w-[480px] mx-auto px-4 pt-6 pb-24 animate-fade-up">
      {/* User info */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-[hsl(93_50%_56%/0.12)] border-2 border-[hsl(93_50%_56%/0.28)] flex items-center justify-center text-lg font-bold text-primary">
          YU
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Your Name</h1>
          <p className="text-xs text-muted-foreground">Member since Jan 2025</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-card rounded-lg border border-[rgba(255,255,255,0.07)] p-4">
              <Icon className="w-4 h-4 text-primary mb-2" />
              <p className="text-lg font-semibold font-mono text-foreground">{stat.value}</p>
              <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.06em] mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Favourite routes */}
      <h2 className="text-sm font-bold text-foreground mb-3">Favourite Routes</h2>
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {FAVOURITE_ROUTES.map((r) => (
          <RouteChip key={r.routeId} routeId={r.routeId} routeLabel={r.routeLabel} agency={r.agency} size="sm" />
        ))}
      </div>

      {/* Settings */}
      <div className="flex flex-col mb-8">
        {SETTINGS_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className="w-full flex items-center gap-2.5 px-0 py-[9px] border-b border-[rgba(255,255,255,0.07)] last:border-none hover:bg-card/50 transition-colors"
            >
              <div className="w-[30px] h-[30px] rounded-sm bg-card flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="flex-1 text-[11px] font-semibold text-foreground text-left">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      {/* Attribution */}
      <div className="text-center font-mono text-[9px] text-[hsl(var(--text-tertiary))] space-y-1 tracking-[0.06em] uppercase">
        <p>Data from Metrolinx · TTC · MiWay · OpenStreetMap</p>
        <p>Interline v1.0.0</p>
      </div>
    </div>
  );
}
