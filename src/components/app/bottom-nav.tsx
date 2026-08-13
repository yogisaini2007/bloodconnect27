import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ListChecks, MessageCircle, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/home", label: "Home", Icon: Home },
  { to: "/requests", label: "Requests", Icon: ListChecks },
  { to: "/chat", label: "Chat", Icon: MessageCircle },
  { to: "/notifications", label: "Alerts", Icon: Bell },
  { to: "/profile", label: "Profile", Icon: User },
] as const;

export function BottomNav({ unread = 0 }: { unread?: number }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 shadow-[0_-4px_20px_oklch(0.208_0.04_265.8/6%)]"
    >
      <ul className="grid grid-cols-5 gap-1">
        {TABS.map(({ to, label, Icon }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <li key={to}>
              <Link
                to={to}
                data-tour={"nav-" + label.toLowerCase()}
                className={cn(
                  "relative flex min-h-13 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-semibold transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-[0_6px_16px_oklch(0.585_0.207_27.3/32%)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
                {label === "Alerts" && unread > 0 && (
                  <span className="absolute right-1.5 top-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-card">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
