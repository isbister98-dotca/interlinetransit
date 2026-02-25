import { cn } from "@/lib/utils";

interface LivePillProps {
  className?: string;
}

export function LivePill({ className }: LivePillProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-[7px] px-2.5 py-1 rounded-sm font-mono text-[10px] font-semibold uppercase tracking-[0.10em] bg-success text-[#0a1208]",
      className
    )}>
      <span className="w-1.5 h-1.5 rounded-full bg-[#0a1208] opacity-70" />
      Live
    </span>
  );
}
