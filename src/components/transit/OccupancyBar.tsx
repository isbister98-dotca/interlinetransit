import { cn } from "@/lib/utils";

interface OccupancyBarProps {
  level: "LOW" | "MEDIUM" | "HIGH" | "FULL";
  className?: string;
}

const LEVELS = { LOW: 1, MEDIUM: 2, HIGH: 3, FULL: 4 } as const;

export function OccupancyBar({ level, className }: OccupancyBarProps) {
  const filled = LEVELS[level];
  return (
    <div className={cn("flex items-center gap-0.5", className)} title={`Occupancy: ${level.toLowerCase()}`}>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={cn(
            "w-1 rounded-full transition-colors",
            i <= 2 ? "h-2" : i === 3 ? "h-2.5" : "h-3",
            i <= filled
              ? filled <= 2 ? "bg-success" : filled === 3 ? "bg-warning" : "bg-destructive"
              : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}
