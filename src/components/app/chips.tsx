import { cn } from "@/lib/utils";
import type { BloodGroup, Urgency, RequestStatus } from "@/lib/blood";
import { AlertTriangle, Clock, CalendarClock } from "lucide-react";

export function BloodChip({
  group,
  size = "md",
  className,
}: {
  group: BloodGroup;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-primary font-bold tabular-nums text-primary-foreground",
        size === "sm" && "h-7 min-w-9 px-2 text-xs",
        size === "md" && "h-10 min-w-12 px-2.5 text-base",
        size === "lg" && "h-14 min-w-16 px-3 text-2xl",
        className,
      )}
    >
      {group}
    </span>
  );
}

const URGENCY_STYLES: Record<Urgency, { label: string; cls: string; Icon: typeof AlertTriangle }> = {
  critical: {
    label: "Critical",
    cls: "bg-primary-soft text-primary border-primary/30",
    Icon: AlertTriangle,
  },
  urgent: {
    label: "Urgent",
    cls: "bg-warning-soft text-warning border-warning/30",
    Icon: Clock,
  },
  normal: {
    label: "Scheduled",
    cls: "bg-muted text-muted-foreground border-border",
    Icon: CalendarClock,
  },
};

export function PriorityChip({ urgency, className }: { urgency: Urgency; className?: string }) {
  const { label, cls, Icon } = URGENCY_STYLES[urgency];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
        cls,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

const STATUS_STYLES: Record<RequestStatus, { label: string; cls: string }> = {
  active: { label: "Searching", cls: "bg-primary-soft text-primary border-primary/30" },
  fulfilled: { label: "Completed", cls: "bg-success-soft text-success border-success/30" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground border-border" },
  expired: { label: "Expired", cls: "bg-muted text-muted-foreground border-border" },
};

export function StatusChip({ status, className }: { status: RequestStatus; className?: string }) {
  const { label, cls } = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        cls,
        className,
      )}
    >
      {label}
    </span>
  );
}
