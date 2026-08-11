import type { ReactNode } from "react";
import { Droplet } from "lucide-react";
import { cn } from "@/lib/utils";

/** Wordmark header matching the BloodConnect brand sheet. */
export function BrandHeader({
  right,
  className,
}: {
  right?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-card px-4 py-3",
        className,
      )}
    >
      <span className="flex size-8 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Droplet className="size-4 fill-current" aria-hidden />
      </span>
      <h1 className="flex-1 text-center text-lg font-extrabold tracking-tight text-primary">
        BloodConnect
      </h1>
      <div className="flex size-8 items-center justify-center">{right}</div>
    </header>
  );
}

export function QuickAction({
  label,
  icon,
  tone = "primary",
  onClick,
}: {
  label: string;
  icon: ReactNode;
  tone?: "primary" | "success" | "secondary" | "muted";
  onClick: () => void;
}) {
  const tones = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    secondary: "bg-primary-soft text-primary",
    muted: "bg-muted text-muted-foreground",
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 py-5 text-sm font-semibold shadow-[var(--shadow-card)] transition-transform active:scale-[0.97]"
    >
      <span className={cn("flex size-11 items-center justify-center rounded-full", tones[tone])}>
        {icon}
      </span>
      {label}
    </button>
  );
}
