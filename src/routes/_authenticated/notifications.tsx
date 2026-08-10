import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useProfile";
import { AppHeader, EmptyState, CardSkeleton } from "@/components/app/shell";
import { BottomNav } from "@/components/app/bottom-nav";
import { timeAgo } from "@/lib/blood";
import { cn } from "@/lib/utils";
import { Bell, Siren, MessageCircle, CheckCircle2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsScreen,
});

const ICONS: Record<string, typeof Bell> = {
  sos: Siren,
  response: CheckCircle2,
  message: MessageCircle,
};

function NotificationsScreen() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  useRealtime("notifications-screen", "notifications", [["all-notifications", userId], ["notifications", userId]]);

  const list = useQuery({
    queryKey: ["all-notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
  });

  const hasUnread = list.data?.some((n) => !n.read) ?? false;

  useEffect(() => {
    if (!userId || !hasUnread) return;
    void supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      });
  }, [userId, hasUnread, queryClient]);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-24">
      <AppHeader title="Alerts" subtitle="Emergency broadcasts and updates" tone="brand" />
      <div className="px-4 py-5">
        {list.isLoading ? (
          <CardSkeleton count={3} />
        ) : (list.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Bell className="size-6" />}
            title="No alerts yet"
            description="You'll be notified here when someone nearby needs your blood group."
          />
        ) : (
          <ul className="space-y-3">
            {list.data!.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              const body = (
                <div
                  className={cn(
                    "flex gap-3 rounded-xl border p-4 transition-colors",
                    n.read ? "border-border bg-card" : "border-primary/30 bg-primary-soft",
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.request_id ? (
                    <Link to="/request/$id" params={{ id: n.request_id }}>
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
