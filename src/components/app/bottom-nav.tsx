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
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-border bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {TABS.map(({ to, label, Icon }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
                {label === "Alerts" && unread > 0 && (
                  <span className="absolute right-1/2 top-1.5 translate-x-4 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground">
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
