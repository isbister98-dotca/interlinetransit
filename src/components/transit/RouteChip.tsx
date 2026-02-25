import { cn } from "@/lib/utils";
import { Agency, AGENCY_COLORS } from "@/lib/types";

interface RouteChipProps {
  routeId: string;
  routeLabel?: string;
  agency: Agency;
  size?: "sm" | "md";
  className?: string;
}

export function RouteChip({ routeId, routeLabel, agency, size = "sm", className }: RouteChipProps) {
  const color = AGENCY_COLORS[agency];
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono font-medium rounded-md whitespace-nowrap",
        size === "sm" ? "text-[10px] px-1.5 py-0.5 gap-1" : "text-xs px-2 py-1 gap-1.5",
        className
      )}
      style={{
        backgroundColor: `hsla(${color}, 0.15)`,
        color: `hsl(${color})`,
        border: `1px solid hsla(${color}, 0.3)`,
      }}
    >
      <span className="font-semibold">{routeId}</span>
      {routeLabel && <span className="opacity-70">{routeLabel}</span>}
    </span>
  );
}
