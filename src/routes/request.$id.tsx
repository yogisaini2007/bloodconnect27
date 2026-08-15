import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useRealtime } from "@/hooks/useProfile";
import { AppHeader, EmptyState, SectionTitle, CardSkeleton } from "@/components/app/shell";
import { ReportDialog } from "@/components/app/report-dialog";
import { BloodChip, PriorityChip, StatusChip } from "@/components/app/chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistance, formatDateTime, daysUntilEligible } from "@/lib/blood";
import type { Database } from "@/integrations/supabase/types";
import { getRequestDonors, type Donor as DonorRow } from "@/lib/matching.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Phone,
  MessageCircle,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  Hospital,
  StickyNote,
} from "lucide-react";

type BloodRequest = Database["public"]["Tables"]["blood_requests"]["Row"];
type Donor = DonorRow;


export const Route = createFileRoute("/request/$id")({
  component: RequestDetail,
});

function RequestDetail() {
  const { id } = Route.useParams();
  const { userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile(userId);
  const [eta, setEta] = useState("");
  const [busy, setBusy] = useState(false);

  useRealtime("request-detail", "request_responses", [
    ["request", id],
    ["donors", id],
    ["my-response", id, userId],
  ]);

  const request = useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blood_requests")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as BloodRequest | null;
    },
  });

  const isOwner = !!userId && request.data?.requester_id === userId;
  const fetchDonors = useServerFn(getRequestDonors);

  const donors = useQuery({
    queryKey: ["donors", id],
    enabled: isOwner,
    queryFn: async () => {
      return await fetchDonors({ data: { requestId: id } });
    },
  });

  const myResponse = useQuery({
    queryKey: ["my-response", id, userId],
    enabled: !!userId && !isOwner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_responses")
        .select("*")
        .eq("request_id", id)
        .eq("donor_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function respond(status: "accepted" | "declined") {
    if (!userId || busy) return;
    setBusy(true);
    const { error } = await supabase.from("request_responses").upsert(
      {
        request_id: id,
        donor_id: userId,
        status,
        eta_note: status === "accepted" && eta.trim() ? eta.trim().slice(0, 120) : null,
      },
      { onConflict: "request_id,donor_id" },
    );
    setBusy(false);
    if (error) {
      toast.error("Could not save your response. Try again.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["my-response", id, userId] });
    void queryClient.invalidateQueries({ queryKey: ["nearby"] });
    toast.success(status === "accepted" ? "Thank you — the requester was notified" : "Response recorded");
  }

  async function updateStatus(status: "fulfilled" | "cancelled") {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.from("blood_requests").update({ status }).eq("id", id);
    setBusy(false);
    if (error) {
      toast.error("Could not update the request.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["request", id] });
    void queryClient.invalidateQueries({ queryKey: ["my-requests", userId] });
    toast.success(status === "fulfilled" ? "Marked as fulfilled" : "Request cancelled");
  }

  if (request.isLoading) {
    return (
      <div className="mx-auto min-h-screen max-w-md bg-background">
        <AppHeader title="Request" back="/home" />
        <div className="p-4">
          <CardSkeleton count={3} />
        </div>
      </div>
    );
  }

  const r = request.data;
  if (!r) {
    return (
      <div className="mx-auto min-h-screen max-w-md bg-background">
        <AppHeader title="Request" back="/home" />
        <div className="p-4">
          <EmptyState
            icon={<XCircle className="size-6" />}
            title="Request unavailable"
            description="This request no longer exists or you don't have access to it."
            action={<Button onClick={() => navigate({ to: "/home" })}>Back to home</Button>}
          />
        </div>
      </div>
    );
  }

  const cooldown = daysUntilEligible(profile?.last_donation_date);
  const accepted = donors.data?.filter((d) => d.response_status === "accepted") ?? [];
  const potential = donors.data?.filter((d) => !d.has_responded) ?? [];

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-28">
      <AppHeader
        title={isOwner ? "Your request" : "Emergency request"}
        back="/home"
        tone="brand"
        action={
          !isOwner && r ? (
            <ReportDialog reportedUserId={r.requester_id} reportedName={r.patient_name} requestId={r.id} />
          ) : undefined
        }
      />

      <div className="space-y-5 px-4 py-5">
        <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-start gap-3">
            <BloodChip group={r.blood_group} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <PriorityChip urgency={r.urgency} />
                <StatusChip status={r.status} />
              </div>
              <p className="mt-2 text-sm font-semibold">
                {r.units} unit{r.units > 1 ? "s" : ""} needed
              </p>
              {r.required_by && (
                <p className="text-xs text-muted-foreground">
                  By {formatDateTime(r.required_by)}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <p className="flex items-start gap-2">
              <Hospital className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                <span className="font-semibold">{r.hospital_name}</span>
                <span className="block text-xs text-muted-foreground">{r.hospital_address}</span>
              </span>
            </p>
            {r.note && (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <StickyNote className="mt-0.5 size-4 shrink-0" aria-hidden />
                {r.note}
              </p>
            )}
            {r.hospital_phone && (
              <a
                href={`tel:${r.hospital_phone}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
              >
                <Phone className="size-3.5" aria-hidden /> Call hospital
              </a>
            )}
          </div>
        </section>

        {/* Donor actions */}
        {!isOwner && r.status === "active" && (
          <section className="rounded-xl border border-border bg-card p-4">
            {cooldown > 0 && (
              <p className="mb-3 rounded-lg bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
                You donated recently — {cooldown} days left before you can donate again. You can
                still decline or help find another donor.
              </p>
            )}
            {myResponse.data ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold">
                  {myResponse.data.status === "accepted"
                    ? "You accepted this request"
                    : "You declined this request"}
                </p>
                {myResponse.data.eta_note && (
                  <p className="text-xs text-muted-foreground">
                    Your note: {myResponse.data.eta_note}
                  </p>
                )}
                {myResponse.data.status === "accepted" && (
                  <Button asChild className="h-12 w-full">
                    <Link
                      to="/chat/$requestId/$peerId"
                      params={{ requestId: r.id, peerId: r.requester_id }}
                    >
                      <MessageCircle className="mr-2 size-4" /> Message the requester
                    </Link>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={busy}
                  onClick={() => respond(myResponse.data!.status === "accepted" ? "declined" : "accepted")}
                >
                  {myResponse.data.status === "accepted" ? "Withdraw" : "Accept instead"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm font-semibold" htmlFor="eta">
                  When can you reach the hospital?
                </label>
                <Input
                  id="eta"
                  value={eta}
                  maxLength={120}
                  onChange={(e) => setEta(e.target.value)}
                  placeholder="e.g. Arriving in 30 mins"
                  className="h-12"
                />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="h-12 flex-1"
                    disabled={busy}
                    onClick={() => respond("declined")}
                  >
                    <XCircle className="mr-1.5 size-4" /> Decline
                  </Button>
                  <Button className="h-12 flex-1" disabled={busy} onClick={() => respond("accepted")}>
                    <CheckCircle2 className="mr-1.5 size-4" /> Accept
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Owner: matched donors */}
        {isOwner && (
          <>
            <section>
              <SectionTitle>
                Donors who accepted{accepted.length > 0 ? ` (${accepted.length})` : ""}
              </SectionTitle>
              {donors.isLoading ? (
                <CardSkeleton />
              ) : accepted.length === 0 ? (
                <EmptyState
                  icon={<Users className="size-6" />}
                  title="Waiting for donors"
                  description="Eligible donors nearby have been alerted. You'll be notified the moment someone accepts."
                />
              ) : (
                <div className="space-y-3">
                  {accepted.map((d) => (
                    <DonorRow key={d.donor_id} donor={d} requestId={r.id} showContact />
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionTitle>Nearby eligible donors ({potential.length})</SectionTitle>
              {potential.length === 0 ? (
                <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  No further matching donors within {r.radius_km} km right now. Try widening the
                  radius or contacting the hospital blood bank.
                </p>
              ) : (
                <div className="space-y-3">
                  {potential.map((d) => (
                    <DonorRow key={d.donor_id} donor={d} requestId={r.id} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {isOwner && r.status === "active" && (
        <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md gap-3 border-t border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button
            variant="outline"
            className="h-12 flex-1"
            disabled={busy}
            onClick={() => updateStatus("cancelled")}
          >
            Cancel request
          </Button>
          <Button className="h-12 flex-1" disabled={busy} onClick={() => updateStatus("fulfilled")}>
            Mark fulfilled
          </Button>
        </div>
      )}
    </div>
  );
}

function DonorRow({
  donor,
  requestId,
  showContact = false,
}: {
  donor: Donor;
  requestId: string;
  showContact?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <BloodChip group={donor.blood_group} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{donor.display_name}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden />
            {formatDistance(donor.distance_km)}
          </p>
        </div>
        {donor.response_status === "accepted" && (
          <span className="rounded-full border border-success/30 bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
            Accepted
          </span>
        )}
      </div>
      {showContact && (
        <div className="mt-3 flex gap-2">
          {donor.phone && (
            <Button asChild variant="outline" className="flex-1">
              <a href={`tel:${donor.phone}`}>
                <Phone className="mr-1.5 size-4" /> Call
              </a>
            </Button>
          )}
          <Button asChild className="flex-1">
            <Link to="/chat/$requestId/$peerId" params={{ requestId, peerId: donor.donor_id }}>
              <MessageCircle className="mr-1.5 size-4" /> Chat
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
