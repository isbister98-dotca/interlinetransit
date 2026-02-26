import { Train, AlertTriangle, Info } from "lucide-react";
import { RouteChip } from "@/components/transit/RouteChip";
import { DepartureRow } from "@/components/transit/DepartureRow";
import { LivePill } from "@/components/transit/LivePill";
import { getStationDepartures, getStationAlerts, type StationResult } from "@/lib/osm-api";

interface SheetStationDetailProps {
  station: StationResult;
}

export function SheetStationDetail({ station }: SheetStationDetailProps) {
  const departures = getStationDepartures(station.name);
  const alerts = getStationAlerts(station.name);

  return (
    <div className="animate-fade-up">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <Train className="w-4.5 h-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate">{station.name}</h3>
          <p className="text-[10px] text-muted-foreground">{station.subtitle || "Transit Station"}</p>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-4">
          {alerts.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-2 px-3 py-2 rounded-md bg-accent/50 mb-1.5"
            >
              {a.severity === "disruption" ? (
                <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
              ) : (
                <Info className="w-3.5 h-3.5 text-info shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold text-foreground">{a.title}</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">{a.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Departures */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Upcoming Departures</h4>
        <LivePill />
      </div>
      <div className="flex flex-col">
        {departures.map((d) => (
          <DepartureRow key={d.id} departure={d} />
        ))}
      </div>
    </div>
  );
}
