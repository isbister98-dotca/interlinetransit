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
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium uppercase tracking-wider",
        status === "on-time" && "bg-success/15 text-success",
        status === "delayed" && "bg-warning/15 text-warning",
        status === "cancelled" && "bg-destructive/15 text-destructive",
        className
      )}
    >
      {status === "on-time" && "On Time"}
      {status === "delayed" && `${delayMinutes ?? ""}m late`}
      {status === "cancelled" && "Cancelled"}
    </span>
  );
}
