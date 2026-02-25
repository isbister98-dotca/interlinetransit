import { cn } from "@/lib/utils";
import { Agency, AGENCY_COLORS } from "@/lib/types";

interface RouteChipProps {
  routeId: string;
  routeLabel?: string;
  agency: Agency;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE_STYLES = {
  xs: "w-6 h-6 text-[10px] rounded-sm",
  sm: "w-[30px] h-[30px] text-xs rounded-md",
  md: "w-10 h-10 text-[15px] rounded-[11px]",
  lg: "w-[52px] h-[52px] text-xl rounded-[15px]",
} as const;

export function RouteChip({ routeId, routeLabel, agency, size = "sm", className }: RouteChipProps) {
  const color = AGENCY_COLORS[agency];
  
  // If routeLabel is provided, use pill style
  if (routeLabel) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 font-mono font-bold rounded-sm whitespace-nowrap",
          size === "xs" ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2.5 py-0.5 h-[26px]",
          className
        )}
        style={{
          backgroundColor: `hsl(${color})`,
          color: `#0e0f0d`,
        }}
      >
        <span>{routeId}</span>
      </span>
    );
  }
  
  // Square chip style (brand guide route chips)
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-mono font-bold flex-shrink-0",
        SIZE_STYLES[size],
        className
      )}
      style={{
        backgroundColor: `hsl(${color})`,
        color: `#0e0f0d`,
      }}
    >
      {routeId}
    </span>
  );
}
