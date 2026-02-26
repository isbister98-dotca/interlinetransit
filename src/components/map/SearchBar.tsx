import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, MapPin, Train, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchPlaces, searchStations, searchRoutes, type SearchResult } from "@/lib/osm-api";
import type { Vehicle } from "@/lib/types";

interface SearchBarProps {
  vehicles: Vehicle[];
  onFocus: () => void;
  onBlur: () => void;
  onSelect: (result: SearchResult) => void;
}

export function SearchBar({ vehicles, onFocus, onBlur, onSelect }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const [places, stations, routes] = await Promise.all([
        searchPlaces(q),
        searchStations(q),
        Promise.resolve(searchRoutes(q, vehicles)),
      ]);
      setResults([...stations, ...routes, ...places].slice(0, 8));
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, [vehicles]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const handleSelect = (result: SearchResult) => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    inputRef.current?.blur();
    onSelect(result);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    setIsOpen(true);
    onFocus();
  };

  const handleBlur = () => {
    // Delay to allow click on results
    setTimeout(() => {
      setIsOpen(false);
      onBlur();
    }, 200);
  };

  const resultIcon = (r: SearchResult) => {
    switch (r.type) {
      case "station": return <Train className="w-4 h-4 text-primary shrink-0" />;
      case "route": return <Route className="w-4 h-4 text-primary shrink-0" />;
      default: return <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />;
    }
  };

  const resultSubtitle = (r: SearchResult) => {
    switch (r.type) {
      case "station": return r.subtitle || "Transit Station";
      case "route": return `${r.agency} · ${r.vehicleCount} active`;
      case "place": return r.subtitle;
    }
  };

  const resultName = (r: SearchResult) => {
    switch (r.type) {
      case "route": return `${r.routeId} — ${r.routeLabel}`;
      default: return r.name;
    }
  };

  return (
    <div className="absolute top-4 left-4 right-4 z-[1001]">
      {/* Search input */}
      <div className="search-bar-container flex items-center gap-2.5 bg-card border border-border rounded-lg px-3 py-2.5">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Search places, routes, stations…"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-sans"
        />
        {query && (
          <button onClick={handleClear} className="p-0.5 rounded hover:bg-accent transition-colors">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && (results.length > 0 || loading) && (
        <div className="mt-1.5 bg-card border border-border rounded-lg overflow-hidden shadow-xl max-h-[320px] overflow-y-auto scrollbar-hide">
          {loading && results.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">Searching…</div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.type}-${i}`}
              onClick={() => handleSelect(r)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors",
                i > 0 && "border-t border-border"
              )}
            >
              {resultIcon(r)}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{resultName(r)}</div>
                <div className="text-[10px] text-muted-foreground truncate">{resultSubtitle(r)}</div>
              </div>
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider shrink-0">
                {r.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
