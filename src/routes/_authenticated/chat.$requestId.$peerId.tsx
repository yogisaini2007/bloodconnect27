import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useProfile";
import { AppHeader, CardSkeleton } from "@/components/app/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Phone, Send } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { getChatThreads, type ChatThread } from "@/lib/matching.functions";
import { useServerFn } from "@tanstack/react-start";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type Thread = ChatThread;

export const Route = createFileRoute("/_authenticated/chat/$requestId/$peerId")({
  component: ChatThread,
});

function ChatThread() {
  const { requestId, peerId } = Route.useParams();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useRealtime("chat-thread", "messages", [["messages", requestId, peerId], ["threads", userId]]);

  const peer = useQuery({
    queryKey: ["threads", userId],
    enabled: !!userId,
    queryFn: async () => {
      return await fetchThreads();
    },
    select: (rows) => rows.find((t) => t.request_id === requestId && t.peer_id === peerId) ?? null,
  });

  const messages = useQuery({
    queryKey: ["messages", requestId, peerId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("request_id", requestId)
        .or(`sender_id.eq.${peerId},recipient_id.eq.${peerId}`)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.data?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !userId || sending) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      request_id: requestId,
      sender_id: userId,
      recipient_id: peerId,
      body: body.slice(0, 1000),
    });
    setSending(false);
    if (error) {
      toast.error("Message not sent. Check your connection.");
      return;
    }
    setText("");
    void queryClient.invalidateQueries({ queryKey: ["messages", requestId, peerId] });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <AppHeader
        title={peer.data?.peer_name ?? "Conversation"}
        subtitle={peer.data?.hospital_name ?? undefined}
        back="/chat"
        tone="brand"
        action={
          peer.data?.peer_phone ? (
            <a
              href={`tel:${peer.data.peer_phone}`}
              aria-label="Call"
              className="flex size-10 items-center justify-center rounded-full bg-primary-dark/40"
            >
              <Phone className="size-5" />
            </a>
          ) : undefined
        }
      />

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5 pb-28">
        {messages.isLoading ? (
          <CardSkeleton count={2} />
        ) : (messages.data?.length ?? 0) === 0 ? (
          <p className="rounded-lg bg-muted p-4 text-center text-xs text-muted-foreground">
            Share the ward number, timings and patient updates here. Keep personal medical details
            to a minimum.
          </p>
        ) : (
          messages.data!.map((m) => {
            const mine = m.sender_id === userId;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                    mine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm border border-border bg-card text-foreground",
                  )}
                >
                  {m.body}
                  <span
                    className={cn(
                      "mt-1 block text-[10px]",
                      mine ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {new Date(m.created_at).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={send}
        className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md gap-2 border-t border-border bg-card p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="Type a message"
          aria-label="Message"
          className="h-12"
        />
        <Button type="submit" size="icon" className="size-12 shrink-0" disabled={sending || !text.trim()}>
          <Send className="size-5" />
        </Button>
      </form>
    </div>
  );
}
