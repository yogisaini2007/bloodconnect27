import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useProfile";
import { AppHeader, EmptyState, CardSkeleton } from "@/components/app/shell";
import { BottomNav } from "@/components/app/bottom-nav";
import { RequestCard, type RequestCardData } from "@/components/app/request-card";
import { cn } from "@/lib/utils";
import { ListChecks } from "lucide-react";

export const Route = createFileRoute("/_authenticated/requests")({
  component: RequestsScreen,
});

type Tab = "mine" | "responded";

function RequestsScreen() {
  const { userId } = useAuth();
  const [tab, setTab] = useState<Tab>("mine");

  useRealtime("requests-screen", "blood_requests", [["all-my-requests", userId], ["responded", userId]]);

  const mine = useQuery({
    queryKey: ["all-my-requests", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blood_requests")
        .select("*")
        .eq("requester_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RequestCardData[];
    },
  });

  const responded = useQuery({
    queryKey: ["responded", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_responses")
        .select("status, blood_requests(*)")
        .eq("donor_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .filter((row) => row.blood_requests)
        .map((row) => ({
          ...(row.blood_requests as unknown as RequestCardData),
          my_response: row.status,
        })) as RequestCardData[];
    },
  });

  const active = tab === "mine" ? mine : responded;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-24">
      <AppHeader title="Requests" subtitle="Your requests and responses" tone="brand" />

      <div className="sticky top-[61px] z-20 flex gap-2 border-b border-border bg-background px-4 py-3">
        {(
          [
            ["mine", "My requests"],
            ["responded", "I responded"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "flex-1 rounded-full border px-3 py-2 text-sm font-semibold transition-colors",
              tab === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 py-5">
        {active.isLoading ? (
          <CardSkeleton count={3} />
        ) : (active.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<ListChecks className="size-6" />}
            title={tab === "mine" ? "No requests yet" : "No responses yet"}
            description={
              tab === "mine"
                ? "Requests you raise with the SOS button will appear here."
                : "Requests you accept or decline will be listed here."
            }
          />
        ) : (
          <div className="space-y-3">
            {active.data!.map((r) => (
              <RequestCard key={r.id} request={r} to="/request/$id" />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
