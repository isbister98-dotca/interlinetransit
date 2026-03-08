import { useState, useRef, useEffect, useCallback } from "react";
import L from "leaflet";
import { Route, Train, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_DEPARTURES } from "@/lib/mock-data";
import { AGENCY_COLORS, type Vehicle } from "@/lib/types";
import { LivePill } from "@/components/transit/LivePill";
import { DepartureRow } from "@/components/transit/DepartureRow";
import { useVehicles } from "@/hooks/use-vehicles";
import { useRouteShapes, getRouteDisplayColor } from "@/hooks/use-route-shapes";
import { useStops, type GtfsStop } from "@/hooks/use-stops";
import { SearchBar } from "@/components/map/SearchBar";
import { SheetPlaceDetail } from "@/components/map/SheetPlaceDetail";
import { SheetRouteDetail } from "@/components/map/SheetRouteDetail";
import { SheetStationDetail } from "@/components/map/SheetStationDetail";
import { SheetStopDetail } from "@/components/map/SheetStopDetail";
import { SheetVehicleDetail } from "@/components/map/SheetVehicleDetail";
import {
  type SearchResult,
  type PlaceResult,
  type StationResult,
  type RouteResult,
  type RouteGeometry,
  fetchRouteGeometry,
} from "@/lib/osm-api";

const GTA_CENTER: [number, number] = [43.6532, -79.3832];
const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

function useUserLocation() {
  const [userLocation, setUserLocation] = useState<[number, number]>(GTA_CENTER);
  const userMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(loc);
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng(loc);
        }
      },
      () => {}, // fallback to GTA_CENTER silently
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return { userLocation, userMarkerRef };
}

// Brand guide v4 SVG icons
const VEHICLE_ICONS: Record<string, string> = {
  train: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="13" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 17.5 7 20m9 0-1.5-2.5M5 12h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="9.5" cy="15" r="1.2" fill="currentColor"/><circle cx="14.5" cy="15" r="1.2" fill="currentColor"/></svg>`,
  subway: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="13" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 17.5 7 20m9 0-1.5-2.5M5 12h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="9.5" cy="15" r="1.2" fill="currentColor"/><circle cx="14.5" cy="15" r="1.2" fill="currentColor"/></svg>`,
  tram: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="13" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 17.5 7 20m9 0-1.5-2.5M5 12h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="9.5" cy="15" r="1.2" fill="currentColor"/><circle cx="14.5" cy="15" r="1.2" fill="currentColor"/></svg>`,
  bus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="13" rx="2.5" stroke="currentColor" stroke-width="1.7"/><path d="M3 10.5h18M7.5 18.5v2m9-2v2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="8" cy="14.5" r="1.2" fill="currentColor"/><circle cx="16" cy="14.5" r="1.2" fill="currentColor"/></svg>`,
};

async function reverseGeocode(lat: number, lng: number): Promise<{ displayName: string; shortName: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    const addr = data.address || {};
    const shortName = addr.amenity || addr.building || addr.road || addr.neighbourhood || data.name || "Unknown location";
    return { displayName: data.display_name || "Unknown", shortName };
  } catch {
    return { displayName: "Could not fetch address", shortName: "Unknown" };
  }
}

function formatDuration(seconds: number) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function createVehicleIcon(vehicle: Vehicle, highlighted = false, colorOverride?: string) {
  const color = colorOverride || `hsl(${AGENCY_COLORS[vehicle.agency]})`;
  const icon = VEHICLE_ICONS[vehicle.vehicleType] ?? VEHICLE_ICONS.bus;
  const glowStyle = highlighted
    ? "box-shadow: 0 0 0 3px hsl(93,50%,56%), 0 2px 8px rgba(0,0,0,0.5);"
    : "box-shadow: 0 2px 8px rgba(0,0,0,0.5);";
  return L.divIcon({
    className: "vehicle-marker",
    html: `<div style="
      display: flex; align-items: center; gap: 4px;
      background: ${color}; color: #0e0f0d;
      font-size: 10px; font-weight: 700;
      font-family: 'IBM Plex Mono', monospace;
      padding: 3px 7px 3px 5px; border-radius: 8px;
      white-space: nowrap; ${glowStyle}
      pointer-events: auto; cursor: pointer;
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

function createDestinationIcon() {
  return L.divIcon({
    className: "destination-marker",
    html: `<div style="
      width: 20px; height: 20px; border-radius: 50% 50% 50% 0;
      background: hsl(93, 50%, 56%); transform: rotate(-45deg);
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
    "><div style="width:8px;height:8px;border-radius:50%;background:#0e0f0d;transform:rotate(45deg);"></div></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 20],
  });
}

function createStopIcon() {
  return L.divIcon({
    className: "stop-marker",
    html: `<div style="width:8px;height:8px;border-radius:50%;background:hsl(93,50%,56%);border:2px solid #0e0f0d;box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  });
}

function createGtfsStopIcon() {
  return L.divIcon({
    className: "gtfs-stop-marker",
    html: `<div style="width:10px;height:10px;border-radius:50%;background:hsl(var(--foreground)/0.7);border:2px solid hsl(var(--background));box-shadow:0 1px 3px rgba(0,0,0,0.4);cursor:pointer;pointer-events:auto;"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

type SheetMode = "nearby" | "place" | "route" | "station" | "vehicle" | "stop" | "hidden";
type LayerMode = "routes" | "vehicles" | "everything" | "off";

const DEFAULT_ZOOM = 14;
const STOP_MIN_ZOOM = 14; // Only show stops at this zoom or more

export default function MapScreen() {
  const [layerMode, setLayerMode] = useState<LayerMode>("vehicles");
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>("nearby");

  // User geolocation
  const { userLocation, userMarkerRef } = useUserLocation();

  // Sheet data
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [placeDistance, setPlaceDistance] = useState<string | undefined>();
  const [placeDuration, setPlaceDuration] = useState<string | undefined>();
  const [placeRouteLoading, setPlaceRouteLoading] = useState(false);

  const [selectedRoute, setSelectedRoute] = useState<RouteResult | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<RouteGeometry | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const [selectedStation, setSelectedStation] = useState<StationResult | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedStop, setSelectedStop] = useState<GtfsStop | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const vehicleLayerRef = useRef<L.LayerGroup | null>(null);
  const shapesLayerRef = useRef<L.LayerGroup | null>(null);
  const overlayLayerRef = useRef<L.LayerGroup | null>(null);
  const stopsLayerRef = useRef<L.LayerGroup | null>(null);
  const vehiclesRef = useRef<Vehicle[]>([]);
  const layerModeRef = useRef<LayerMode>("vehicles");
  const showLayersRef = useRef(true);
  const shapesDrawnRef = useRef(false);
  const stopsDrawnZoom = useRef<number | null>(null);
  const selectedRouteRef = useRef<RouteResult | null>(null);
  const selectedVehicleRef = useRef<Vehicle | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);

  const { vehicles } = useVehicles();
  const { shapes } = useRouteShapes();
  const { stops: gtfsStops } = useStops();
  vehiclesRef.current = vehicles;
  layerModeRef.current = layerMode;
  showLayersRef.current = layerMode === "vehicles" || layerMode === "everything";
  const clearOverlays = useCallback(() => {
    if (destinationMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(destinationMarkerRef.current);
      destinationMarkerRef.current = null;
    }
    if (routeLineRef.current && mapRef.current) {
      mapRef.current.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    overlayLayerRef.current?.clearLayers();
  }, []);

  const resetSheet = useCallback(() => {
    clearOverlays();
    setSheetMode("nearby");
    setSelectedPlace(null);
    setSelectedRoute(null);
    setSelectedStation(null);
    setSelectedVehicle(null);
    setSelectedStop(null);
    setPlaceDistance(undefined);
    setPlaceDuration(undefined);
    setRouteGeometry(null);
  }, [clearOverlays]);

  // Handle search result selection
  const handleSearchSelect = useCallback(async (result: SearchResult) => {
    resetSheet();
    const map = mapRef.current;
    if (!map) return;

    if (result.type === "place") {
      setSelectedPlace(result);
      setSheetMode("place");
      map.flyTo([result.lat, result.lng], 16, { duration: 1 });
      const marker = L.marker([result.lat, result.lng], { icon: createDestinationIcon() }).addTo(map);
      destinationMarkerRef.current = marker;
    } else if (result.type === "station") {
      setSelectedStation(result);
      setSheetMode("station");
      map.flyTo([result.lat, result.lng], 16, { duration: 1 });
      const marker = L.marker([result.lat, result.lng], { icon: createDestinationIcon() }).addTo(map);
      destinationMarkerRef.current = marker;
    } else if (result.type === "route") {
      setSelectedRoute(result);
      setSheetMode("route");
      setRouteLoading(true);

      // Fetch route geometry
      const geo = await fetchRouteGeometry(result.routeId, result.agency);
      setRouteGeometry(geo);
      setRouteLoading(false);

      if (geo && geo.coords.length > 0) {
        const polyline = L.polyline(geo.coords, {
          color: "hsl(93, 50%, 56%)",
          weight: 3,
          opacity: 0.7,
        }).addTo(overlayLayerRef.current || map);

        geo.stops.forEach((s) => {
          L.marker([s.lat, s.lng], { icon: createStopIcon() })
            .bindTooltip(s.name, { className: "dark-popup", direction: "top", offset: [0, -6] })
            .addTo(overlayLayerRef.current || map);
        });

        map.fitBounds(polyline.getBounds(), { padding: [60, 100] });
      }
    }

    setSheetExpanded(result.type !== "place");
  }, [resetSheet]);

  // Handle vehicle marker click
  const handleVehicleClick = useCallback(async (vehicle: Vehicle) => {
    clearOverlays();
    setSelectedVehicle(vehicle);
    setSheetMode("vehicle");
    setSheetExpanded(false);

    // Zoom to clicked vehicle
    const map = mapRef.current;
    if (map) {
      map.flyTo([vehicle.lat, vehicle.lng], 15, { duration: 0.8 });
    }

    // Draw the vehicle's route shape from cached shapes onto overlay layer
    // GO GTFS route_ids are prefixed (e.g. "01260426-LW"), vehicle routeIds are just the suffix
    const matchingShape = shapes.find(
      (s) => s.agency_id === vehicle.agency && (
        s.route_id === vehicle.routeId || s.route_id.endsWith(`-${vehicle.routeId}`)
      )
    );
    if (matchingShape && matchingShape.coords.length >= 2 && overlayLayerRef.current) {
      const color = getRouteDisplayColor(matchingShape, AGENCY_COLORS);
      L.polyline(matchingShape.coords, {
        color,
        weight: 3,
        opacity: 0.7,
        interactive: false,
      }).addTo(overlayLayerRef.current);
    }

    // Fetch route geometry for stop timeline
    setRouteLoading(true);
    const geo = await fetchRouteGeometry(vehicle.routeId, vehicle.agency);
    setRouteGeometry(geo);
    setRouteLoading(false);
  }, [clearOverlays, shapes]);

  // Handle stop marker click
  const handleStopClick = useCallback((stop: GtfsStop) => {
    clearOverlays();
    setSelectedStop(stop);
    setSheetMode("stop");
    setSheetExpanded(true);

    const map = mapRef.current;
    if (map) {
      map.flyTo([stop.stop_lat, stop.stop_lon], Math.max(map.getZoom(), 15), { duration: 0.8 });
    }
  }, [clearOverlays]);

  // Get directions for place
  const handleGetDirections = useCallback(async () => {
    if (!selectedPlace || !mapRef.current) return;
    setPlaceRouteLoading(true);

    const from: [number, number] = userLocation;
    const to: [number, number] = [selectedPlace.lat, selectedPlace.lng];

    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
      );
      const data = await res.json();

      if (data.routes?.[0]) {
        const route = data.routes[0];
        const coords: [number, number][] = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);

        if (routeLineRef.current) mapRef.current.removeLayer(routeLineRef.current);

        const polyline = L.polyline(coords, {
          color: "hsl(93, 50%, 56%)",
          weight: 4,
          opacity: 0.8,
          dashArray: "8, 6",
        }).addTo(mapRef.current);
        routeLineRef.current = polyline;

        mapRef.current.fitBounds(polyline.getBounds(), { padding: [60, 60] });

        setPlaceDistance(formatDistance(route.distance));
        setPlaceDuration(formatDuration(route.duration));
      }
    } catch { /* ignore */ }

    setPlaceRouteLoading(false);
  }, [selectedPlace, userLocation]);

  // Track vehicle
  const handleTrackVehicle = useCallback(() => {
    if (!selectedVehicle || !mapRef.current) return;
    mapRef.current.flyTo([selectedVehicle.lat, selectedVehicle.lng], 15, { duration: 0.8 });
  }, [selectedVehicle]);

  // Handle map click (reverse geocode → place mode)
  const handleMapClick = useCallback(async (e: L.LeafletMouseEvent) => {
    const { lat, lng } = e.latlng;
    const map = mapRef.current;
    if (!map) return;

    resetSheet();

    const marker = L.marker([lat, lng], { icon: createDestinationIcon() }).addTo(map);
    destinationMarkerRef.current = marker;

    const loadingPlace: PlaceResult = { type: "place", osmId: "", name: "Loading…", subtitle: "", lat, lng, displayName: "" };
    setSelectedPlace(loadingPlace);
    setSheetMode("place");
    setSheetExpanded(false);

    const { displayName, shortName } = await reverseGeocode(lat, lng);
    setSelectedPlace({ type: "place", osmId: "", name: shortName, subtitle: "", lat, lng, displayName });
  }, [resetSheet]);

  // Helper to find matching shape for a vehicle
  const findShapeForVehicle = useCallback((v: Vehicle) => {
    return shapes.find(
      (s) => s.agency_id === v.agency && (
        s.route_id === v.routeId || s.route_id.endsWith(`-${v.routeId}`)
      )
    );
  }, [shapes]);

  const syncMarkers = useCallback(() => {
    const layer = vehicleLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();

    if (!showLayersRef.current && !selectedVehicleRef.current) return;

    const activeRoute = selectedRouteRef.current;
    const activeVehicle = selectedVehicleRef.current;
    const zoom = map.getZoom();

    vehiclesRef.current.forEach((v) => {
      // If a vehicle is selected, only show vehicles matching its route + agency
      if (activeVehicle) {
        if (v.routeId !== activeVehicle.routeId || v.agency !== activeVehicle.agency) return;
      } else {
        // If a route is selected, only show vehicles matching both routeId AND agency
        if (activeRoute && (v.routeId !== activeRoute.routeId || v.agency !== activeRoute.agency)) return;

        // Hide vehicles if layers are off
        if (!showLayersRef.current) return;

        // Zoom-based priority filtering (skip when a specific route is selected)
        if (!activeRoute) {
          const isTrain = v.vehicleType === "train" || v.vehicleType === "subway";
          const isTram = v.vehicleType === "tram";
          if (zoom <= 10 && !isTrain) return;
          if (zoom > 10 && zoom <= 12 && !isTrain && !isTram) return;
        }
      }

      // Determine color: use route_color when available
      const matchingShape = findShapeForVehicle(v);
      const colorOverride = matchingShape?.route_color
        ? `#${matchingShape.route_color}`
        : undefined;

      const isHighlighted = activeVehicle && v.id === activeVehicle.id;
      const marker = L.marker([v.lat, v.lng], { icon: createVehicleIcon(v, !!isHighlighted, colorOverride) });
      marker.on("click", () => handleVehicleClick(v));
      marker.addTo(layer);
    });
  }, [handleVehicleClick, findShapeForVehicle]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const container = mapContainerRef.current;
    (container as any)._leaflet_id = null;

    const map = L.map(container, {
      center: userLocation,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer(DARK_TILES, { maxZoom: 18, updateWhenIdle: false, updateWhenZooming: false }).addTo(map);
    const userMarker = L.marker(userLocation, { icon: createUserIcon() }).addTo(map);
    userMarkerRef.current = userMarker;

    const vehicleLayer = L.layerGroup().addTo(map);
    const shapesLayer = L.layerGroup().addTo(map);
    const stopsLayer = L.layerGroup().addTo(map);
    const overlayLayer = L.layerGroup().addTo(map);
    mapRef.current = map;
    vehicleLayerRef.current = vehicleLayer;
    shapesLayerRef.current = shapesLayer;
    stopsLayerRef.current = stopsLayer;
    overlayLayerRef.current = overlayLayer;

    map.on("click", (e: L.LeafletMouseEvent) => handleMapClick(e));
    map.on("zoomend", () => { syncMarkers(); syncStops(); });

    // Fix tile loading by ensuring map knows its container size
    requestAnimationFrame(() => map.invalidateSize());
    const resizeTimer = setTimeout(() => map.invalidateSize(), 300);

    syncMarkers();

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      vehicleLayerRef.current = null;
      shapesLayerRef.current = null;
      stopsLayerRef.current = null;
      overlayLayerRef.current = null;
    };
  }, [syncMarkers, handleMapClick]);

  // Sync vehicles on data/mode change
  useEffect(() => {
    selectedRouteRef.current = selectedRoute;
    selectedVehicleRef.current = selectedVehicle;
    syncMarkers();
  }, [vehicles, layerMode, selectedRoute, selectedVehicle, syncMarkers]);

  // Draw shapes when data arrives or mode changes
  useEffect(() => {
    const layer = shapesLayerRef.current;
    if (!layer) return;

    const showShapes = layerMode === "routes" || layerMode === "everything";

    if (!showShapes) {
      layer.clearLayers();
      shapesDrawnRef.current = false;
      return;
    }

    // Only redraw if not already drawn
    if (shapesDrawnRef.current && layer.getLayers().length > 0) return;
    if (shapes.length === 0) return;

    layer.clearLayers();
    // Sort so route_type 3 (bus) draws first (below), then 0,1,2 draw on top
    const sorted = [...shapes].sort((a, b) => {
      const aIsRail = a.route_type != null && a.route_type !== 3 ? 1 : 0;
      const bIsRail = b.route_type != null && b.route_type !== 3 ? 1 : 0;
      return aIsRail - bIsRail;
    });
    sorted.forEach((shape) => {
      if (shape.coords.length < 2) return;
      const color = getRouteDisplayColor(shape, AGENCY_COLORS);
      L.polyline(shape.coords, {
        color,
        weight: 2,
        opacity: 0.45,
        interactive: false,
      }).addTo(layer);
    });
    shapesDrawnRef.current = true;
  }, [shapes, layerMode]);

  const isSheetVisible = sheetMode !== "hidden";

  return (
    <div className="relative w-full h-[calc(100dvh-72px)]">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Search bar */}
      <SearchBar
        vehicles={vehicles}
        onFocus={() => setSheetMode("hidden")}
        onBlur={() => { if (sheetMode === "hidden") setSheetMode("nearby"); }}
        onSelect={handleSearchSelect}
      />

      {/* Layers control */}
      <div className="absolute top-[68px] right-4 z-[1000] flex items-center rounded-lg overflow-hidden bg-card border border-border">
        {([
          { mode: "routes" as LayerMode, icon: Route, label: "Routes" },
          { mode: "vehicles" as LayerMode, icon: Train, label: "Vehicles" },
          { mode: "everything" as LayerMode, icon: Sparkles, label: "All" },
        ]).map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            onClick={() => {
              if (mode === "everything" && layerMode === "everything") {
                setLayerMode("off");
              } else {
                setLayerMode(mode);
              }
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors",
              layerMode === mode
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Back to nearby button when in a detail mode */}
      {sheetMode !== "nearby" && sheetMode !== "hidden" && (
        <button
          onClick={resetSheet}
          className="absolute top-[68px] left-4 z-[1000] flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
      )}

      {/* Bottom sheet */}
      <div
        className={cn(
          "absolute left-0 right-0 z-[1000] bg-surface-1 rounded-t-xl border-t border-border transition-all duration-300 ease-out",
          isSheetVisible
            ? sheetExpanded
              ? (sheetMode === "vehicle" || sheetMode === "place") ? "bottom-0 max-h-[85%]" : "bottom-0 h-[70%]"
              : (sheetMode === "vehicle" || sheetMode === "place") ? "bottom-0" : "bottom-0 h-[30%]"
            : "bottom-0 h-0 overflow-hidden"
        )}
      >
        {isSheetVisible && (
          <>
            <button
              className="w-full flex justify-center py-2 cursor-grab active:cursor-grabbing"
              onClick={() => setSheetExpanded(!sheetExpanded)}
            >
              <div className="w-8 h-1 rounded-full bg-[rgba(255,255,255,0.20)]" />
            </button>

            <div className="px-4 pb-4 overflow-y-auto scrollbar-hide h-[calc(100%-24px)]">
              {/* Nearby (default) */}
              {sheetMode === "nearby" && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-foreground">Nearby Stops</h2>
                    <LivePill />
                  </div>
                  <div className="flex flex-col">
                    {MOCK_DEPARTURES.map((d) => (
                      <DepartureRow key={d.id} departure={d} />
                    ))}
                  </div>
                </>
              )}

              {/* Place detail */}
              {sheetMode === "place" && selectedPlace && (
                <SheetPlaceDetail
                  place={selectedPlace}
                  distance={placeDistance}
                  duration={placeDuration}
                  loading={placeRouteLoading}
                  onGetDirections={handleGetDirections}
                  onClose={resetSheet}
                />
              )}

              {/* Route detail */}
              {sheetMode === "route" && selectedRoute && (
                <SheetRouteDetail
                  route={selectedRoute}
                  vehicles={vehicles}
                  geometry={routeGeometry}
                  loading={routeLoading}
                />
              )}

              {/* Station detail */}
              {sheetMode === "station" && selectedStation && (
                <SheetStationDetail station={selectedStation} />
              )}

              {/* Vehicle detail */}
              {sheetMode === "vehicle" && selectedVehicle && (
                <SheetVehicleDetail
                  vehicle={selectedVehicle}
                  onTrack={handleTrackVehicle}
                  routeGeometry={routeGeometry}
                  routeLoading={routeLoading}
                  expanded={sheetExpanded}
                  routeShape={findShapeForVehicle(selectedVehicle) ?? null}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
