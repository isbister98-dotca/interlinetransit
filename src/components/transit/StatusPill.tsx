import { cn } from "@/lib/utils";

interface StatusPillProps {
  status: "on-time" | "delayed" | "cancelled";
  delayMinutes?: number;
  className?: string;
}

export function StatusPill({ status, delayMinutes, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-[5px] rounded-sm font-mono text-[11px] font-semibold uppercase tracking-[0.03em]",
        status === "on-time" && "bg-success text-[#0e1210]",
        status === "delayed" && "bg-warning text-[#150e00]",
        status === "cancelled" && "bg-destructive text-foreground",
        className
      )}
    >
      {status === "on-time" && "On Time"}
      {status === "delayed" && `+${delayMinutes ?? ""}m Late`}
      {status === "cancelled" && "Cancelled"}
    </span>
  );
}
