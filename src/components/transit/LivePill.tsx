import { cn } from "@/lib/utils";

interface LivePillProps {
  className?: string;
}

export function LivePill({ className }: LivePillProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-mono font-medium uppercase tracking-wider text-primary", className)}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-primary animate-pulse-ring" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      Live
    </span>
  );
}
