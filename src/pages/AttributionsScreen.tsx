import { ArrowLeft, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ATTRIBUTIONS = [
  {
    name: "Toronto Transit Commission (TTC)",
    description: "Subway, streetcar, and bus data for the City of Toronto.",
    url: "https://www.ttc.ca",
  },
  {
    name: "Metrolinx / GO Transit",
    description: "Regional rail and bus data across the Greater Toronto and Hamilton Area.",
    url: "https://www.gotransit.com",
  },
  {
    name: "UP Express",
    description: "Airport rail link service data between Union Station and Toronto Pearson.",
    url: "https://www.upexpress.com",
  },
  {
    name: "MiWay",
    description: "Transit data for the City of Mississauga.",
    url: "https://www.mississauga.ca/miway-transit",
  },
  {
    name: "OpenStreetMap",
    description: "Map tiles and geographic data used for route rendering.",
    url: "https://www.openstreetmap.org",
    license: "© OpenStreetMap contributors – ODbL",
  },
  {
    name: "Leaflet",
    description: "Open-source JavaScript library for interactive maps.",
    url: "https://leafletjs.com",
  },
];

export default function AttributionsScreen() {
  const navigate = useNavigate();

  return (
    <div className="max-w-[480px] mx-auto px-4 pt-6 pb-24 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/profile")}
          className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Attributions</h1>
      </div>

      <p className="text-xs text-muted-foreground mb-5">
        Interline relies on data from the following sources. We gratefully acknowledge their contributions.
      </p>

      <div className="flex flex-col gap-3">
        {ATTRIBUTIONS.map((attr) => (
          <a
            key={attr.name}
            href={attr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-card rounded-lg border border-border p-4 flex items-start gap-3 hover:bg-accent/50 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-foreground">{attr.name}</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{attr.description}</p>
              {attr.license && (
                <p className="text-[9px] font-mono text-muted-foreground mt-1.5 uppercase tracking-[0.06em]">
                  {attr.license}
                </p>
              )}
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        ))}
      </div>
    </div>
  );
}
