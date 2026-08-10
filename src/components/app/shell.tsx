import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppHeader({
  title,
  subtitle,
  back,
  action,
  tone = "light",
}: {
  title: string;
  subtitle?: string | undefined;
  back?: string | undefined;
  action?: ReactNode | undefined;
  tone?: "light" | "brand" | undefined;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3",
        tone === "brand"
          ? "border-primary-dark/30 bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground",
      )}
    >
      {back && (
        <Link
          to={back}
          aria-label="Go back"
          className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold">{title}</h1>
        {subtitle && (
          <p
            className={cn(
              "truncate text-xs",
              tone === "brand" ? "text-primary-foreground/80" : "text-muted-foreground",
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode | undefined }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function CardSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-card" />
      ))}
    </div>
  );
}
