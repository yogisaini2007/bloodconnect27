import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useProfile";
import { AppHeader, EmptyState, CardSkeleton } from "@/components/app/shell";
import { BottomNav } from "@/components/app/bottom-nav";
import { BloodChip } from "@/components/app/chips";
import { timeAgo } from "@/lib/blood";
import type { Database } from "@/integrations/supabase/types";
import { getChatThreads, type ChatThread } from "@/lib/matching.functions";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle } from "lucide-react";

type Thread = ChatThread;

export const Route = createFileRoute("/_authenticated/chat/")({
  component: ChatList,
});

function ChatList() {
  const { userId } = useAuth();
  useRealtime("chat-list", "messages", [["threads", userId]]);

  const threads = useQuery({
    queryKey: ["threads", userId],
    enabled: !!userId,
    queryFn: async () => {
      return await fetchThreads();
    },
  });

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-24">
      <AppHeader title="Messages" subtitle="Coordinate with donors and requesters" tone="brand" />
      <div className="px-4 py-5">
        {threads.isLoading ? (
          <CardSkeleton count={3} />
        ) : (threads.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<MessageCircle className="size-6" />}
            title="No conversations yet"
            description="Chats open automatically once you accept a request or a donor accepts yours."
          />
        ) : (
          <ul className="space-y-3">
            {threads.data!.map((t) => (
              <li key={`${t.request_id}-${t.peer_id}`}>
                <Link
                  to="/chat/$requestId/$peerId"
                  params={{ requestId: t.request_id, peerId: t.peer_id }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <BloodChip group={t.blood_group} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{t.peer_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.last_message || t.hospital_name}
                    </p>
                  </div>
                  {t.last_message_at && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {timeAgo(t.last_message_at)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
