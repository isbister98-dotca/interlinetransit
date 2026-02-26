import { Navigation, MapPin } from "lucide-react";
import type { PlaceResult } from "@/lib/osm-api";

interface SheetPlaceDetailProps {
  place: PlaceResult;
  distance?: string;
  duration?: string;
  loading: boolean;
  onGetDirections: () => void;
  onClose: () => void;
}

export function SheetPlaceDetail({ place, distance, duration, loading, onGetDirections, onClose }: SheetPlaceDetailProps) {
  return (
    <div className="animate-fade-up">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <MapPin className="w-4.5 h-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate">{place.name}</h3>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{place.displayName}</p>
        </div>
      </div>

      {distance && duration && (
        <div className="flex items-center gap-3 mb-4 px-3 py-2 rounded-md bg-accent/50">
          <span className="text-xs font-mono font-bold text-primary">{distance}</span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-xs font-mono text-muted-foreground">{duration}</span>
        </div>
      )}

      {!distance && (
        <button
          onClick={onGetDirections}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:opacity-[0.88] transition-opacity disabled:opacity-50"
        >
          <Navigation className="w-3.5 h-3.5" />
          {loading ? "Getting route…" : "Route To"}
        </button>
      )}
    </div>
  );
}
