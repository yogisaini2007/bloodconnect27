import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/app/shell";
import { BottomNav } from "@/components/app/bottom-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ShieldCheck, ShieldX, Lock, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — BLOODCONNECT" },
      {
        name: "description",
        content: "Private BloodConnect admin console for growth stats, user directory, reports and support tickets.",
      },
      { property: "og:title", content: "BLOODCONNECT Admin Panel" },
      { property: "og:description", content: "Private admin console for the BloodConnect team." },
    ],
  }),
  component: AdminPanel,
});

type Stats = {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
  available_donors: number;
  banned_users: number;
  restricted_users: number;
  total_requests: number;
  active_requests: number;
  accepted_responses: number;
  pending_reports: number;
  open_tickets: number;
  by_blood_group: Record<string, number>;
  signups_by_day: { day: string; count: number }[];
};

function AdminPanel() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const isAdmin = useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_app_admin", { _user_id: userId! });
      if (error) throw error;
      return !!data;
    },
  });

  const allowed = isAdmin.data === true;

  const stats = useQuery({
    queryKey: ["admin-stats"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_stats");
      if (error) throw error;
      return data as unknown as Stats;
    },
  });

  const users = useQuery({
    queryKey: ["admin-users", search],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_users", { p_search: search });
      if (error) throw error;
      return data ?? [];
    },
  });

  const reports = useQuery({
    queryKey: ["admin-reports"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_reports");
      if (error) throw error;
      return data ?? [];
    },
  });

  const tickets = useQuery({
    queryKey: ["admin-tickets"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_tickets");
      if (error) throw error;
      return data ?? [];
    },
  });

  function refreshAll() {
    for (const key of [["admin-stats"], ["admin-users", search], ["admin-reports"], ["admin-tickets"]]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  }

  async function reviewReport(id: string, status: "valid" | "invalid") {
    const { error } = await supabase.rpc("admin_review_report", {
      p_report_id: id,
      p_status: status,
    });
    if (error) {
      toast.error("Action failed.");
      return;
    }
    toast.success(status === "valid" ? "Marked valid" : "Marked invalid");
    refreshAll();
  }

  async function setBan(id: string, banned: boolean) {
    const { error } = await supabase.rpc("admin_set_ban", {
      p_user_id: id,
      p_banned: banned,
      p_reason: banned ? "Banned by BloodConnect admin after review" : undefined,
    });
    if (error) {
      toast.error("Action failed.");
      return;
    }
    toast.success(banned ? "Account banned" : "Ban removed");
    refreshAll();
  }

  async function closeTicket(id: string) {
    const { error } = await supabase.rpc("admin_update_ticket", {
      p_ticket_id: id,
      p_status: "resolved",
    });
    if (error) {
      toast.error("Action failed.");
      return;
    }
    refreshAll();
  }

  if (isAdmin.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Checking access…</div>;
  }

  if (!allowed) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Lock className="size-7" aria-hidden />
        </span>
        <h1 className="text-lg font-bold">Restricted area</h1>
        <p className="text-sm text-muted-foreground">
          The admin panel is available only to the official BloodConnect account.
        </p>
        <Button asChild variant="outline">
          <Link to="/home">Back to home</Link>
        </Button>
      </div>
    );
  }

  const s = stats.data;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-24">
      <AppHeader title="Admin Panel" subtitle="BloodConnect control centre" tone="brand" />

      <div className="space-y-4 px-4 py-5">
        <section className="grid grid-cols-2 gap-3">
          <Stat label="Total users" value={s?.total_users} />
          <Stat label="New this week" value={s?.new_users_7d} accent />
          <Stat label="New in 30 days" value={s?.new_users_30d} />
          <Stat label="Available donors" value={s?.available_donors} />
          <Stat label="Blood requests" value={s?.total_requests} />
          <Stat label="Active requests" value={s?.active_requests} />
          <Stat label="Accepted donations" value={s?.accepted_responses} />
          <Stat label="Banned accounts" value={s?.banned_users} />
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <TrendingUp className="size-4 text-primary" aria-hidden /> Sign-ups (last 30 days)
          </h2>
          <Sparkline data={s?.signups_by_day ?? []} />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(s?.by_blood_group ?? {}).map(([bg, count]) => (
              <span key={bg} className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold">
                {bg}: {count}
              </span>
            ))}
          </div>
        </section>

        <Tabs defaultValue="users">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="reports">
              Reports{s?.pending_reports ? ` (${s.pending_reports})` : ""}
            </TabsTrigger>
            <TabsTrigger value="tickets">
              Support{s?.open_tickets ? ` (${s.open_tickets})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or phone"
            />
            {(users.data ?? []).map((u) => (
              <article key={u.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{u.full_name || "Unnamed"}</p>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                    {u.blood_group ?? "—"}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{u.email ?? "no email"}</p>
                <p className="text-xs text-muted-foreground">{u.phone || "no phone"}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Joined {new Date(u.created_at).toLocaleDateString()} · valid reports{" "}
                  {u.valid_report_count}
                  {u.restricted && !u.is_banned ? " · restricted" : ""}
                </p>
                <Button
                  size="sm"
                  variant={u.is_banned ? "outline" : "destructive"}
                  className="mt-2 w-full"
                  onClick={() => setBan(u.id, !u.is_banned)}
                >
                  {u.is_banned ? (
                    <>
                      <ShieldCheck className="mr-2 size-4" /> Unban account
                    </>
                  ) : (
                    <>
                      <ShieldX className="mr-2 size-4" /> Ban account
                    </>
                  )}
                </Button>
              </article>
            ))}
            {users.data?.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No users found.</p>
            )}
          </TabsContent>

          <TabsContent value="reports" className="space-y-2">
            {(reports.data ?? []).map((r) => (
              <article key={r.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">
                    {r.reported_name || "Unnamed"} {r.reported_banned ? "· banned" : ""}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      r.status === "valid"
                        ? "bg-destructive/10 text-destructive"
                        : r.status === "invalid"
                          ? "bg-muted text-muted-foreground"
                          : "bg-warning/10 text-warning",
                    )}
                  >
                    {r.status}
                  </span>
                </div>
                <p className="text-xs font-medium">{r.reason.replace(/_/g, " ")}</p>
                {r.details && <p className="text-xs text-muted-foreground">{r.details}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  by {r.reporter_name || "user"} · {new Date(r.created_at).toLocaleDateString()}
                </p>
                {r.status === "pending" && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => reviewReport(r.id, "valid")}>
                      Valid
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => reviewReport(r.id, "invalid")}
                    >
                      Invalid
                    </Button>
                  </div>
                )}
              </article>
            ))}
            {reports.data?.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No reports yet.</p>
            )}
          </TabsContent>

          <TabsContent value="tickets" className="space-y-2">
            {(tickets.data ?? []).map((t) => (
              <article key={t.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{t.subject}</p>
                  <span className="shrink-0 text-[10px] font-bold uppercase text-muted-foreground">
                    {t.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{t.category}</p>
                <p className="mt-1 text-xs">{t.message}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t.user_name || "user"} · {t.contact_email}
                </p>
                {t.status !== "resolved" && t.status !== "closed" && (
                  <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => closeTicket(t.id)}>
                    Mark resolved
                  </Button>
                )}
              </article>
            ))}
            {tickets.data?.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No support requests.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value?: number | undefined; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <p className={cn("text-2xl font-bold tabular-nums", accent && "text-primary")}>{value ?? "—"}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Sparkline({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (data.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">No sign-ups yet.</p>;
  }
  return (
    <div className="mt-3 flex h-20 items-end gap-1">
      {data.map((d) => (
        <span
          key={d.day}
          title={`${d.day}: ${d.count}`}
          className="flex-1 rounded-t bg-primary/70"
          style={{ height: `${Math.max(6, (d.count / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
