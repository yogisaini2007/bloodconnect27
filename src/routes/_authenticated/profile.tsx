import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { AppHeader } from "@/components/app/shell";
import { BottomNav } from "@/components/app/bottom-nav";
import { BloodChip } from "@/components/app/chips";
import { Button } from "@/components/ui/button";
import { daysUntilEligible, DONATION_COOLDOWN_DAYS } from "@/lib/blood";
import { toast } from "sonner";
import { Droplet, LogOut, MapPin, Pencil, Phone, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfileScreen,
});

function ProfileScreen() {
  const { userId, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile(userId);

  const donations = useQuery({
    queryKey: ["donation-count", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("request_responses")
        .select("id", { count: "exact", head: true })
        .eq("donor_id", userId!)
        .eq("status", "accepted");
      if (error) throw error;
      return count ?? 0;
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  async function markDonatedToday() {
    if (!userId) return;
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("profiles")
      .update({ last_donation_date: today })
      .eq("id", userId);
    if (error) {
      toast.error("Could not update your donation date.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    toast.success("Donation recorded. Thank you for saving a life!");
  }

  const cooldown = daysUntilEligible(profile?.last_donation_date);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-24">
      <AppHeader
        title="Profile"
        subtitle={user?.email ?? undefined}
        tone="brand"
        action={
          <Link
            to="/onboarding"
            aria-label="Edit profile"
            className="flex size-10 items-center justify-center rounded-full bg-primary-dark/40"
          >
            <Pencil className="size-4" />
          </Link>
        }
      />

      <div className="space-y-5 px-4 py-5">
        <section className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          {profile?.blood_group ? (
            <BloodChip group={profile.blood_group} size="lg" />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Droplet className="size-6" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-bold">{profile?.full_name || "Unnamed donor"}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="size-3.5" aria-hidden /> {profile?.phone || "No phone saved"}
            </p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{donations.data ?? 0}</p>
            <p className="text-xs text-muted-foreground">Requests accepted</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p
              className={
                cooldown > 0
                  ? "text-2xl font-bold tabular-nums text-warning"
                  : "text-2xl font-bold tabular-nums text-success"
              }
            >
              {cooldown > 0 ? cooldown : "Now"}
            </p>
            <p className="text-xs text-muted-foreground">
              {cooldown > 0 ? "Days until eligible" : "Eligible to donate"}
            </p>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <Row
            icon={<Droplet className="size-4" />}
            label="Last donation"
            value={profile?.last_donation_date ?? "Never recorded"}
          />
          <Row
            icon={<MapPin className="size-4" />}
            label="Current address"
            value={profile?.current_address || "Not set"}
          />
          <Row
            icon={<MapPin className="size-4" />}
            label="Permanent address"
            value={profile?.permanent_address || "Not set"}
          />
          <Button variant="outline" className="w-full" onClick={markDonatedToday}>
            I donated today
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Recording a donation starts the {DONATION_COOLDOWN_DAYS}-day recovery period, during
            which you won't be matched to new requests.
          </p>
        </section>

        <section className="flex items-start gap-2 rounded-xl bg-muted p-4 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          Your phone number and exact location are only shared with a requester after you accept
          their request.
        </section>

        <Button variant="outline" className="h-12 w-full" onClick={signOut}>
          <LogOut className="mr-2 size-4" /> Sign out
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block font-medium">{value}</span>
      </span>
    </div>
  );
}
