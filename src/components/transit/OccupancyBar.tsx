import { cn } from "@/lib/utils";

interface OccupancyBarProps {
  level: "LOW" | "MEDIUM" | "HIGH" | "FULL";
  className?: string;
}

const LEVELS = { LOW: 1, MEDIUM: 3, HIGH: 5, FULL: 5 } as const;
const TOTAL = 5;

export function OccupancyBar({ level, className }: OccupancyBarProps) {
  const filled = LEVELS[level];
  return (
    <div className={cn("flex items-center gap-[3px]", className)} title={`Occupancy: ${level.toLowerCase()}`}>
      {Array.from({ length: TOTAL }, (_, i) => (
        <div
          key={i}
          className={cn(
            "flex-1 h-1 rounded-full",
            i < filled
              ? level === "LOW" ? "bg-success" 
                : level === "MEDIUM" ? "bg-warning" 
                : "bg-destructive"
              : "bg-[rgba(255,255,255,0.12)]"
          )}
          style={{ width: 12 }}
        />
      ))}
    </div>
  );
}
