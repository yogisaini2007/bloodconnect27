import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { AppHeader } from "@/components/app/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BLOOD_GROUPS,
  URGENCY,
  RADIUS_OPTIONS,
  compatibleDonors,
  type BloodGroup,
  type Urgency,
} from "@/lib/blood";
import { LocationPicker } from "@/components/app/location-picker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Minus, Plus, Siren } from "lucide-react";


export const Route = createFileRoute("/_authenticated/sos")({
  component: SosWizard,
});

const schema = z.object({
  patient_name: z.string().trim().max(80).optional(),
  hospital_name: z.string().trim().min(2, "Enter the hospital name").max(120),
  hospital_address: z.string().trim().min(4, "Enter the hospital address").max(300),
  hospital_phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9+\-\s()]*$/, "Invalid phone number")
    .optional(),
  note: z.string().trim().max(500).optional(),
});

function SosWizard() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile(userId);

  const [step, setStep] = useState(0);
  const [group, setGroup] = useState<BloodGroup | "">("");
  const [units, setUnits] = useState(1);
  const [urgency, setUrgency] = useState<Urgency>("critical");
  const [requiredBy, setRequiredBy] = useState("");
  const [radius, setRadius] = useState(10);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [details, setDetails] = useState({
    patient_name: "",
    hospital_name: "",
    hospital_address: "",
    hospital_phone: "",
    note: "",
  });

  useEffect(() => {
    if (profile?.lat != null && profile?.lng != null && !coords) {
      setCoords({ lat: profile.lat, lng: profile.lng });
    }
  }, [profile, coords]);

  async function useHospitalLocation() {
    setLocating(true);
    const result = await requestBrowserLocation();
    setLocating(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setCoords({ lat: result.lat, lng: result.lng });
    toast.success("Hospital location captured");
  }

  async function submit() {
    if (submitting || !userId) return;
    if (!group) {
      toast.error("Select the required blood group.");
      setStep(0);
      return;
    }
    const parsed = schema.safeParse({
      patient_name: details.patient_name || undefined,
      hospital_name: details.hospital_name,
      hospital_address: details.hospital_address,
      hospital_phone: details.hospital_phone || undefined,
      note: details.note || undefined,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      toast.error("Please complete the hospital details.");
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { data, error } = await supabase
      .from("blood_requests")
      .insert({
        requester_id: userId,
        blood_group: group,
        units,
        urgency,
        radius_km: radius,
        required_by: requiredBy ? new Date(requiredBy).toISOString() : null,
        patient_name: parsed.data.patient_name ?? "",
        hospital_name: parsed.data.hospital_name,
        hospital_address: parsed.data.hospital_address,
        hospital_phone: parsed.data.hospital_phone ?? null,
        note: parsed.data.note ?? null,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error("Could not send the request. Check your connection and try again.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["my-requests", userId] });
    toast.success("SOS broadcast to nearby donors");
    void navigate({ to: "/request/$id", params: { id: data.id }, replace: true });
  }

  const compat = group ? compatibleDonors(group) : [];

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-28">
      <AppHeader title="Emergency blood request" subtitle={`Step ${step + 1} of 3`} back="/home" tone="brand" />

      <div className="h-1 w-full bg-muted">
        <div
          className="h-1 bg-primary transition-all"
          style={{ width: `${((step + 1) / 3) * 100}%` }}
        />
      </div>

      <div className="space-y-6 px-4 py-5">
        {step === 0 && (
          <>
            <div>
              <Label className="mb-2 block">Required blood group</Label>
              <div className="grid grid-cols-4 gap-2">
                {BLOOD_GROUPS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGroup(g)}
                    className={cn(
                      "h-14 rounded-lg border text-lg font-bold transition-colors",
                      group === g
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
              {group && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Compatible donors: {compat.join(", ")}
                </p>
              )}
            </div>

            <div>
              <Label className="mb-2 block">Units needed</Label>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Decrease units"
                  onClick={() => setUnits((u) => Math.max(1, u - 1))}
                >
                  <Minus className="size-4" />
                </Button>
                <span className="flex-1 text-center text-2xl font-bold tabular-nums">{units}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Increase units"
                  onClick={() => setUnits((u) => Math.min(10, u + 1))}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Urgency</Label>
              <div className="space-y-2">
                {URGENCY.map((u) => (
                  <button
                    key={u.value}
                    type="button"
                    onClick={() => setUrgency(u.value)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors",
                      urgency === u.value
                        ? "border-primary bg-primary-soft"
                        : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <span>
                      <span className="block text-sm font-semibold">{u.label}</span>
                      <span className="block text-xs text-muted-foreground">{u.hint}</span>
                    </span>
                    <span
                      className={cn(
                        "size-4 rounded-full border-2",
                        urgency === u.value ? "border-primary bg-primary" : "border-border",
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            {urgency === "normal" && (
              <div className="space-y-2">
                <Label htmlFor="requiredBy">Needed by</Label>
                <Input
                  id="requiredBy"
                  type="datetime-local"
                  value={requiredBy}
                  onChange={(e) => setRequiredBy(e.target.value)}
                  className="h-12"
                />
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="hospital">Hospital name</Label>
              <Input
                id="hospital"
                value={details.hospital_name}
                maxLength={120}
                onChange={(e) => setDetails({ ...details, hospital_name: e.target.value })}
                placeholder="City General Hospital"
                className="h-12"
              />
              {errors['hospital_name'] && (
                <p className="text-xs font-medium text-destructive">{errors['hospital_name']}</p>
              )}
            </div>

            <LocationPicker
              label="Hospital address"
              hint="Search the hospital or use GPS so donors see the distance."
              placeholder="Hospital, street, area, city"
              value={{
                address: details.hospital_address,
                lat: coords?.lat ?? null,
                lng: coords?.lng ?? null,
              }}
              onChange={(next) => {
                setDetails((d) => ({ ...d, hospital_address: next.address }));
                setCoords(
                  next.lat != null && next.lng != null ? { lat: next.lat, lng: next.lng } : null,
                );
              }}
              error={errors['hospital_address']}
            />


            <div className="space-y-2">
              <Label htmlFor="hphone">Hospital / ward phone (optional)</Label>
              <Input
                id="hphone"
                type="tel"
                inputMode="tel"
                maxLength={20}
                value={details.hospital_phone}
                onChange={(e) => setDetails({ ...details, hospital_phone: e.target.value })}
                placeholder="+91 80 1234 5678"
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient">Patient name (optional)</Label>
              <Input
                id="patient"
                value={details.patient_name}
                maxLength={80}
                onChange={(e) => setDetails({ ...details, patient_name: e.target.value })}
                placeholder="Kept private until a donor accepts"
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Note for donors (optional)</Label>
              <Textarea
                id="note"
                value={details.note}
                maxLength={500}
                rows={3}
                onChange={(e) => setDetails({ ...details, note: e.target.value })}
                placeholder="Ward number, attendant contact, condition details"
              />
            </div>

          </>
        )}

        {step === 2 && (
          <>
            <div>
              <Label className="mb-2 block">Search radius</Label>
              <div className="grid grid-cols-4 gap-2">
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadius(r)}
                    className={cn(
                      "h-12 rounded-lg border text-sm font-semibold transition-colors",
                      radius === r
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    {r} km
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
              <Row label="Blood group" value={group || "—"} />
              <Row label="Units" value={String(units)} />
              <Row
                label="Urgency"
                value={URGENCY.find((u) => u.value === urgency)?.label ?? "—"}
              />
              <Row label="Hospital" value={details.hospital_name || "—"} />
              <Row label="Radius" value={`${radius} km`} />
              <Row label="Location" value={coords ? "Pinned" : "Not pinned"} />
            </div>

            {!coords && (
              <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
                Without a pinned location we can only alert donors in your area by blood group —
                distances will not be shown.
              </p>
            )}
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="outline" className="h-12 flex-1" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {step < 2 ? (
            <Button
              className="h-12 flex-1 text-base"
              onClick={() => {
                if (step === 0 && !group) {
                  toast.error("Select the required blood group.");
                  return;
                }
                setStep(step + 1);
              }}
            >
              Continue
            </Button>
          ) : (
            <Button className="h-12 flex-1 text-base" onClick={submit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Siren className="mr-2 size-4" />
              )}
              Broadcast SOS
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-semibold">{value}</span>
    </div>
  );
}
