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
import { BLOOD_GROUPS, type BloodGroup, daysUntilEligible } from "@/lib/blood";
import { requestBrowserLocation } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(80),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20)
    .regex(/^[0-9+\-\s()]+$/, "Phone can only contain digits and + - ( )"),
  permanent_address: z.string().trim().min(4, "Enter your permanent address").max(300),
  current_address: z.string().trim().min(4, "Enter your current address").max(300),
  blood_group: z.enum(BLOOD_GROUPS as [BloodGroup, ...BloodGroup[]]),
  last_donation_date: z.string().max(10).optional(),
});

function Onboarding() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile(userId);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    permanent_address: "",
    current_address: "",
    blood_group: "" as BloodGroup | "",
    last_donation_date: "",
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!profile) return;
    setForm((f) => ({
      full_name: profile.full_name || f.full_name,
      phone: profile.phone || f.phone,
      permanent_address: profile.permanent_address || f.permanent_address,
      current_address: profile.current_address || f.current_address,
      blood_group: profile.blood_group ?? f.blood_group,
      last_donation_date: profile.last_donation_date ?? f.last_donation_date,
    }));
    if (profile.lat != null && profile.lng != null) {
      setCoords({ lat: profile.lat, lng: profile.lng });
    }
  }, [profile]);

  async function useMyLocation() {
    setLocating(true);
    const result = await requestBrowserLocation();
    setLocating(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setCoords({ lat: result.lat, lng: result.lng });
    toast.success("Location captured");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !userId) return;
    const parsed = schema.safeParse({
      ...form,
      last_donation_date: form.last_donation_date || undefined,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setErrors({});
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      permanent_address: parsed.data.permanent_address,
      current_address: parsed.data.current_address,
      blood_group: parsed.data.blood_group,
      last_donation_date: parsed.data.last_donation_date ?? null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      location_updated_at: coords ? new Date().toISOString() : null,
      onboarded: true,
    });
    setSaving(false);
    if (error) {
      toast.error("Could not save your profile. Please try again.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    toast.success("Profile saved");
    void navigate({ to: "/home", replace: true });
  }

  const cooldown = daysUntilEligible(form.last_donation_date || null);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-10">
      <AppHeader title="Complete your profile" subtitle="Step 1 of 1" tone="brand" />
      <form onSubmit={save} className="space-y-5 px-4 py-5">
        <Field label="Full name" error={errors['full_name']}>
          <Input
            value={form.full_name}
            maxLength={80}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="Aditi Sharma"
            className="h-12"
          />
        </Field>

        <Field label="Phone number" error={errors['phone']} hint="Donors will call you on this number">
          <Input
            value={form.phone}
            type="tel"
            inputMode="tel"
            maxLength={20}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+91 98765 43210"
            className="h-12"
          />
        </Field>

        <div>
          <Label className="mb-2 block">Blood group</Label>
          <div className="grid grid-cols-4 gap-2">
            {BLOOD_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setForm({ ...form, blood_group: g })}
                className={cn(
                  "h-12 rounded-lg border text-base font-bold transition-colors",
                  form.blood_group === g
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/40",
                )}
              >
                {g}
              </button>
            ))}
          </div>
          {errors['blood_group'] && (
            <p className="mt-1.5 text-xs font-medium text-destructive">Select your blood group</p>
          )}
        </div>

        <Field
          label="Last donation date"
          hint={
            form.last_donation_date
              ? cooldown > 0
                ? `Eligible again in ${cooldown} days`
                : "You are eligible to donate"
              : "Leave empty if you have never donated"
          }
        >
          <Input
            type="date"
            value={form.last_donation_date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setForm({ ...form, last_donation_date: e.target.value })}
            className="h-12"
          />
        </Field>

        <Field label="Permanent address" error={errors['permanent_address']}>
          <Textarea
            value={form.permanent_address}
            maxLength={300}
            rows={2}
            onChange={(e) => setForm({ ...form, permanent_address: e.target.value })}
            placeholder="House, street, city, state"
          />
        </Field>

        <LocationPicker
          label="Current address"
          hint="Type your area or use GPS so we can match emergencies near you."
          placeholder="Where you are staying right now"
          value={{
            address: form.current_address,
            lat: coords?.lat ?? null,
            lng: coords?.lng ?? null,
          }}
          onChange={(next) => {
            setForm((f) => ({ ...f, current_address: next.address }));
            setCoords(next.lat != null && next.lng != null ? { lat: next.lat, lng: next.lng } : null);
          }}
          error={errors['current_address']}
        />


        <Button type="submit" className="h-12 w-full text-base" disabled={saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save and continue
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
