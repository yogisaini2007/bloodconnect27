import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useRealtime } from "@/hooks/useProfile";
import { EmptyState, SectionTitle, CardSkeleton } from "@/components/app/shell";
import { BottomNav } from "@/components/app/bottom-nav";
import { BrandHeader, QuickAction } from "@/components/app/brand-header";
import { BloodChip } from "@/components/app/chips";
import { RequestCard, type RequestCardData } from "@/components/app/request-card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { daysUntilEligible } from "@/lib/blood";
import { requestBrowserLocation } from "@/lib/geo";
import { toast } from "sonner";
import {
  Droplets,
  MapPin,
  Siren,
  RefreshCw,
  Inbox,
  Heart,
  MessageCircle,
  UserRound,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomeScreen,
});

function HomeScreen() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useProfile(userId);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!isLoading && profile && !profile.onboarded) {
      void navigate({ to: "/onboarding", replace: true });
    }
    if (!isLoading && profile === null) {
      void navigate({ to: "/onboarding", replace: true });
    }
  }, [isLoading, profile, navigate]);

  useRealtime("home-alerts", "notifications", [["notifications", userId], ["nearby"]]);
  useRealtime("home-requests", "blood_requests", [["nearby"], ["my-requests", userId]]);

  const nearby = useQuery({
    queryKey: ["nearby"],
    enabled: !!profile?.onboarded,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("nearby_requests");
      if (error) throw error;
      return (data ?? []) as unknown as RequestCardData[];
    },
  });

  const myActive = useQuery({
    queryKey: ["my-requests", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blood_requests")
        .select("*")
        .eq("requester_id", userId!)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RequestCardData[];
    },
  });

  const unread = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });

  async function toggleAvailability(next: boolean) {
    if (!userId) return;
    const { error } = await supabase
      .from("profiles")
      .update({ is_available: next })
      .eq("id", userId);
    if (error) {
      toast.error("Could not update availability.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    toast.success(next ? "You're available to donate" : "Marked as unavailable");
  }

  async function refreshLocation() {
    if (!userId) return;
    setLocating(true);
    const result = await requestBrowserLocation();
    if (!result.ok) {
      setLocating(false);
      toast.error(result.message);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        lat: result.lat,
        lng: result.lng,
        location_updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    setLocating(false);
    if (error) {
      toast.error("Could not save your location.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    void queryClient.invalidateQueries({ queryKey: ["nearby"] });
    toast.success("Location updated");
  }

  const cooldown = daysUntilEligible(profile?.last_donation_date);
  const hasLocation = profile?.lat != null && profile?.lng != null;
  const staleLocation =
    hasLocation &&
    profile?.location_updated_at != null &&
    Date.now() - new Date(profile.location_updated_at).getTime() > 24 * 3600 * 1000;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-32">
      <BrandHeader
        right={
          profile?.blood_group ? <BloodChip group={profile.blood_group} size="sm" /> : undefined
        }
      />

      <div className="space-y-6 px-4 py-5">
        {/* Welcome */}
        <section>
          <h2 className="text-2xl font-extrabold tracking-tight">
            Welcome,{" "}
            <span className="text-primary">
              {profile?.full_name ? profile.full_name.split(" ")[0] : "User"}
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">Ready to save a life today?</p>
        </section>

        {/* Quick actions */}
        <section className="grid grid-cols-2 gap-3">
          <QuickAction
            label="Need Blood"
            tone="primary"
            icon={<Droplets className="size-5" aria-hidden />}
            onClick={() => navigate({ to: "/sos" })}
          />
          <QuickAction
            label="Donate Blood"
            tone="success"
            icon={<Heart className="size-5 fill-current" aria-hidden />}
            onClick={() => navigate({ to: "/requests" })}
          />
          <QuickAction
            label="Messages"
            tone="secondary"
            icon={<MessageCircle className="size-5" aria-hidden />}
            onClick={() => navigate({ to: "/chat" })}
          />
          <QuickAction
            label="My Profile"
            tone="muted"
            icon={<UserRound className="size-5" aria-hidden />}
            onClick={() => navigate({ to: "/profile" })}
          />
        </section>

        {/* Availability + eligibility */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Donor availability</p>
              <p className="text-xs text-muted-foreground">
                {profile?.is_available
                  ? "You will receive nearby emergency alerts"
                  : "You are hidden from donor searches"}
              </p>
            </div>
            <Switch
              checked={!!profile?.is_available}
              onCheckedChange={toggleAvailability}
              aria-label="Toggle donor availability"
            />
          </div>

          <div className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs">
            {cooldown > 0 ? (
              <span className="font-medium text-warning">
                Not eligible yet — {cooldown} day{cooldown > 1 ? "s" : ""} left of the 90-day
                recovery period.
              </span>
            ) : (
              <span className="font-medium text-success">Eligible to donate</span>
            )}
          </div>
        </section>

        {/* Location status */}
        <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <MapPin
            className={hasLocation ? "size-5 text-success" : "size-5 text-warning"}
            aria-hidden
          />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {hasLocation ? (staleLocation ? "Location may be outdated" : "Location active") : "Location not set"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {profile?.current_address || "Refresh to match with nearby requests"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refreshLocation} disabled={locating}>
            <RefreshCw className={locating ? "size-4 animate-spin" : "size-4"} aria-hidden />
            <span className="ml-1.5">Refresh</span>
          </Button>
        </section>

        {/* My active requests */}
        {(myActive.data?.length ?? 0) > 0 && (
          <section>
            <SectionTitle>Your active request</SectionTitle>
            <div className="space-y-3">
              {myActive.data!.map((r) => (
                <RequestCard key={r.id} request={r} to="/request/$id" />
              ))}
            </div>
          </section>
        )}

        {/* Nearby requests */}
        <section>
          <SectionTitle>Nearby requests you can answer</SectionTitle>
          {nearby.isLoading ? (
            <CardSkeleton />
          ) : (nearby.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={<Inbox className="size-6" />}
              title="No matching requests nearby"
              description={
                hasLocation
                  ? "You'll be alerted the moment someone near you needs your blood group."
                  : "Set your location so we can match you with nearby emergencies."
              }
              action={
                !hasLocation ? (
                  <Button onClick={refreshLocation} disabled={locating}>
                    <MapPin className="mr-1.5 size-4" /> Use my location
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {nearby.data!.map((r) => (
                <RequestCard key={r.id} request={r} to="/request/$id" />
              ))}
            </div>
          )}
        </section>

        <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground">
          <Droplets className="mt-0.5 size-4 shrink-0" aria-hidden />
          BLOODCONNECT coordinates volunteer donors. Always follow the hospital's medical
          screening and never rely on this app alone in a medical emergency.
        </p>
      </div>

      {/* Floating SOS */}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 mx-auto flex max-w-md justify-center px-4 pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          onClick={() => navigate({ to: "/sos" })}
          className="sos-pulse pointer-events-auto inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-sos)] transition-transform active:scale-95"
        >
          <Siren className="size-5" aria-hidden />
          SOS — Need Blood Now
        </button>
      </div>

      <BottomNav unread={unread.data ?? 0} />

    </div>
  );
}
