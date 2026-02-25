import { useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_VEHICLES, MOCK_DEPARTURES } from "@/lib/mock-data";
import { AGENCY_COLORS, type Vehicle } from "@/lib/types";
import { RouteChip } from "@/components/transit/RouteChip";
import { LivePill } from "@/components/transit/LivePill";
import { DepartureRow } from "@/components/transit/DepartureRow";

const GTA_CENTER: [number, number] = [43.6532, -79.3832];
const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

function createVehicleIcon(vehicle: Vehicle) {
  const color = AGENCY_COLORS[vehicle.agency];
  return L.divIcon({
    className: "vehicle-marker",
    html: `<div style="
      background: hsla(${color}, 0.9);
      color: hsl(var(--background));
      font-size: 9px;
      font-weight: 700;
      font-family: 'DM Mono', monospace;
      padding: 2px 5px;
      border-radius: 4px;
      white-space: nowrap;
      transform: rotate(0deg);
      box-shadow: 0 0 8px hsla(${color}, 0.5);
      border: 1px solid hsla(${color}, 1);
    ">${vehicle.routeId}</div>`,
    iconSize: [0, 0],
    iconAnchor: [15, 10],
  });
}

function UserLocationMarker() {
  return (
    <Marker
      position={GTA_CENTER}
      icon={L.divIcon({
        className: "user-marker",
        html: `<div style="position:relative;width:16px;height:16px;">
          <div style="position:absolute;inset:-4px;border-radius:50%;background:hsla(82,85%,55%,0.2);animation:pulse-ring 1.5s ease-out infinite;"></div>
          <div style="width:16px;height:16px;border-radius:50%;background:hsl(82,85%,55%);border:2px solid hsl(var(--background));box-shadow:0 0 12px hsla(82,85%,55%,0.6);"></div>
        </div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })}
    />
  );
}

export default function MapScreen() {
  const [showLayers, setShowLayers] = useState(true);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  return (
    <div className="relative w-full h-[calc(100dvh-60px)]">
      {/* Map */}
      <MapContainer
        center={GTA_CENTER}
        zoom={12}
        className="w-full h-full z-0"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url={DARK_TILES} />
        <UserLocationMarker />

        {showLayers &&
          MOCK_VEHICLES.map((v) => (
            <Marker key={v.id} position={[v.lat, v.lng]} icon={createVehicleIcon(v)}>
              <Popup className="dark-popup">
                <div className="text-xs">
                  <RouteChip routeId={v.routeId} routeLabel={v.routeLabel} agency={v.agency} size="md" />
                  <p className="mt-1 text-muted-foreground">{v.speed} km/h</p>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>

      {/* Layers toggle */}
      <button
        onClick={() => setShowLayers(!showLayers)}
        className={cn(
          "absolute top-4 left-4 z-[1000] glass flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
          showLayers ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Layers className="w-4 h-4" />
        <span>Layers</span>
      </button>

      {/* Bottom sheet */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 z-[1000] glass rounded-t-2xl transition-all duration-300 ease-out",
          sheetExpanded ? "h-[70%]" : "h-[30%]"
        )}
      >
        {/* Drag handle */}
        <button
          className="w-full flex justify-center py-2 cursor-grab active:cursor-grabbing"
          onClick={() => setSheetExpanded(!sheetExpanded)}
        >
          <div className="w-10 h-1 rounded-full bg-muted-foreground/40" />
        </button>

        <div className="px-4 pb-4 overflow-y-auto h-[calc(100%-24px)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Union Station</h2>
            <LivePill />
          </div>

          <div className="flex flex-col gap-2">
            {MOCK_DEPARTURES.map((d) => (
              <DepartureRow key={d.id} departure={d} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
