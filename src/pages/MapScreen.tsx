import { useState, useRef, useEffect, useCallback } from "react";
import L from "leaflet";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_DEPARTURES } from "@/lib/mock-data";
import { AGENCY_COLORS, type Vehicle } from "@/lib/types";
import { LivePill } from "@/components/transit/LivePill";
import { DepartureRow } from "@/components/transit/DepartureRow";
import { useVehicles } from "@/hooks/use-vehicles";

const GTA_CENTER: [number, number] = [43.6532, -79.3832];
const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

// Brand guide v4 SVG icons
const VEHICLE_ICONS: Record<string, string> = {
  train: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="13" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 17.5 7 20m9 0-1.5-2.5M5 12h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="9.5" cy="15" r="1.2" fill="currentColor"/><circle cx="14.5" cy="15" r="1.2" fill="currentColor"/></svg>`,
  subway: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="13" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 17.5 7 20m9 0-1.5-2.5M5 12h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="9.5" cy="15" r="1.2" fill="currentColor"/><circle cx="14.5" cy="15" r="1.2" fill="currentColor"/></svg>`,
  tram: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="13" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 17.5 7 20m9 0-1.5-2.5M5 12h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="9.5" cy="15" r="1.2" fill="currentColor"/><circle cx="14.5" cy="15" r="1.2" fill="currentColor"/></svg>`,
  bus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="13" rx="2.5" stroke="currentColor" stroke-width="1.7"/><path d="M3 10.5h18M7.5 18.5v2m9-2v2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="8" cy="14.5" r="1.2" fill="currentColor"/><circle cx="16" cy="14.5" r="1.2" fill="currentColor"/></svg>`,
};

function createVehicleIcon(vehicle: Vehicle) {
  const color = AGENCY_COLORS[vehicle.agency];
  const icon = VEHICLE_ICONS[vehicle.vehicleType] ?? VEHICLE_ICONS.bus;
  return L.divIcon({
    className: "vehicle-marker",
    html: `<div style="
      display: flex;
      align-items: center;
      gap: 4px;
      background: hsl(${color});
      color: #0e0f0d;
      font-size: 10px;
      font-weight: 700;
      font-family: 'IBM Plex Mono', monospace;
      padding: 3px 7px 3px 5px;
      border-radius: 8px;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      pointer-events: auto;
    ">${icon}<span>${vehicle.routeId}</span></div>`,
    iconSize: [50, 24],
    iconAnchor: [25, 12],
  });
}

function createUserIcon() {
  return L.divIcon({
    className: "user-marker",
    html: `<div style="position:relative;width:13px;height:13px;">
      <div style="position:absolute;inset:-5px;border-radius:50%;background:hsla(210,74%,63%,0.22);animation:pulse-ring 1.5s ease-out infinite;"></div>
      <div style="width:13px;height:13px;border-radius:50%;background:#5EA8E8;border:2.5px solid #EEF0EB;box-shadow:0 0 0 5px rgba(94,168,232,0.22);"></div>
    </div>`,
    iconSize: [13, 13],
    iconAnchor: [7, 7],
  });
}

export default function MapScreen() {
  const [showLayers, setShowLayers] = useState(true);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const vehicleLayerRef = useRef<L.LayerGroup | null>(null);
  const vehiclesRef = useRef<Vehicle[]>([]);
  const showLayersRef = useRef(true);

  const { vehicles } = useVehicles();

  // Keep refs in sync
  vehiclesRef.current = vehicles;
  showLayersRef.current = showLayers;

  const syncMarkers = useCallback(() => {
    const layer = vehicleLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    if (!showLayersRef.current) return;

    vehiclesRef.current.forEach((v) => {
      const marker = L.marker([v.lat, v.lng], { icon: createVehicleIcon(v) });
      marker.bindPopup(
        `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:13px;font-weight:700;margin-bottom:4px">${v.routeLabel}</div>
         <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#7D8578;letter-spacing:0.06em;text-transform:uppercase">${v.agency} · ${v.routeId} · ${v.speed != null ? v.speed + ' km/h' : ''}</div>`,
        { className: "dark-popup", closeButton: false }
      );
      marker.addTo(layer);
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const container = mapContainerRef.current;
    (container as any)._leaflet_id = null;

    const map = L.map(container, {
      center: GTA_CENTER,
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer(DARK_TILES, { maxZoom: 18 }).addTo(map);
    L.marker(GTA_CENTER, { icon: createUserIcon() }).addTo(map);

    const vehicleLayer = L.layerGroup().addTo(map);
    mapRef.current = map;
    vehicleLayerRef.current = vehicleLayer;

    syncMarkers();

    return () => {
      map.remove();
      mapRef.current = null;
      vehicleLayerRef.current = null;
    };
  }, [syncMarkers]);

  // Update markers when vehicles or showLayers change
  useEffect(() => {
    syncMarkers();
  }, [vehicles, showLayers, syncMarkers]);

  return (
    <div className="relative w-full h-[calc(100dvh-60px)]">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Layers toggle */}
      <button
        onClick={() => setShowLayers(!showLayers)}
        className={cn(
          "absolute top-4 left-4 z-[1000] flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold transition-all",
          "bg-card border border-border",
          showLayers ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Layers className="w-4 h-4" />
        <span>Layers</span>
      </button>

      {/* Bottom sheet */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 z-[1000] bg-surface-1 rounded-t-xl border-t border-border transition-all duration-300 ease-out",
          sheetExpanded ? "h-[70%]" : "h-[30%]"
        )}
      >
        <button
          className="w-full flex justify-center py-2 cursor-grab active:cursor-grabbing"
          onClick={() => setSheetExpanded(!sheetExpanded)}
        >
          <div className="w-8 h-1 rounded-full bg-[rgba(255,255,255,0.20)]" />
        </button>

        <div className="px-4 pb-4 overflow-y-auto scrollbar-hide h-[calc(100%-24px)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground">Nearby Stops</h2>
            <LivePill />
          </div>

          <div className="flex flex-col">
            {MOCK_DEPARTURES.map((d) => (
              <DepartureRow key={d.id} departure={d} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
