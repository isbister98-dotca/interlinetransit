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
        <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-lg font-bold text-primary">
          YU
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Your Name</h1>
          <p className="text-xs text-muted-foreground">Member since Jan 2025</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-surface-1 rounded-xl border border-border p-3">
              <Icon className="w-4 h-4 text-primary mb-2" />
              <p className="text-lg font-semibold font-mono text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Favourite routes */}
      <h2 className="text-sm font-semibold text-foreground mb-3">Favourite Routes</h2>
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {FAVOURITE_ROUTES.map((r) => (
          <RouteChip key={r.routeId} routeId={r.routeId} routeLabel={r.routeLabel} agency={r.agency} size="md" />
        ))}
      </div>

      {/* Settings */}
      <div className="space-y-1 mb-8">
        {SETTINGS_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-surface-1 hover:bg-surface-2 transition-colors"
            >
              <Icon className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1 text-sm text-foreground text-left">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      {/* Attribution */}
      <div className="text-center text-[10px] text-muted-foreground space-y-1">
        <p>Data from Metrolinx · TTC · MiWay · OpenStreetMap</p>
        <p>Interline v1.0.0</p>
      </div>
    </div>
  );
}
