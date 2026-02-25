import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RouteChip } from "@/components/transit/RouteChip";
import { LivePill } from "@/components/transit/LivePill";
import { DepartureRow } from "@/components/transit/DepartureRow";
import { MOCK_DEPARTURES, MOCK_ALERTS } from "@/lib/mock-data";

const SEVERITY_STYLES = {
  disruption: { border: "border-l-destructive", icon: AlertTriangle, iconColor: "text-destructive" },
  warning: { border: "border-l-warning", icon: AlertCircle, iconColor: "text-warning" },
  info: { border: "border-l-info", icon: Info, iconColor: "text-info" },
};

export default function AlertsScreen() {
  const hasAlerts = MOCK_ALERTS.length > 0;

  return (
    <div className="max-w-[480px] mx-auto px-4 pt-6 pb-24 animate-fade-up overflow-y-auto scrollbar-hide">
      {/* Departures */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">Union Station Departures</h2>
          <LivePill />
        </div>
        <div className="flex flex-col">
          {MOCK_DEPARTURES.slice(0, 4).map((d) => (
            <DepartureRow key={d.id} departure={d} />
          ))}
        </div>
      </div>

      {/* Alerts */}
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
  );
}
