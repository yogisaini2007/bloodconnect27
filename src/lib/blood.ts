import type { Database } from "@/integrations/supabase/types";

export type BloodGroup = Database["public"]["Enums"]["blood_group"];
export type Urgency = Database["public"]["Enums"]["urgency_level"];
export type RequestStatus = Database["public"]["Enums"]["request_status"];
export type ResponseStatus = Database["public"]["Enums"]["response_status"];

export const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

export const URGENCY: { value: Urgency; label: string; hint: string }[] = [
  { value: "critical", label: "Critical", hint: "Needed immediately" },
  { value: "urgent", label: "Urgent", hint: "Needed within hours" },
  { value: "normal", label: "Scheduled", hint: "Planned / future date" },
];

export const RADIUS_OPTIONS = [5, 10, 25, 50];

export const DONATION_COOLDOWN_DAYS = 90;

/** Days until the donor becomes eligible again. 0 = eligible now. */
export function daysUntilEligible(lastDonationDate: string | null | undefined): number {
  if (!lastDonationDate) return 0;
  const last = new Date(lastDonationDate + "T00:00:00");
  if (Number.isNaN(last.getTime())) return 0;
  const next = new Date(last);
  next.setDate(next.getDate() + DONATION_COOLDOWN_DAYS);
  const diff = Math.ceil((next.getTime() - Date.now()) / 86_400_000);
  return diff > 0 ? diff : 0;
}

/** Donors whose blood a recipient of `recipient` can receive. */
const COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  "AB+": ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
  "AB-": ["AB-", "A-", "B-", "O-"],
  "A+": ["A+", "A-", "O+", "O-"],
  "A-": ["A-", "O-"],
  "B+": ["B+", "B-", "O+", "O-"],
  "B-": ["B-", "O-"],
  "O+": ["O+", "O-"],
  "O-": ["O-"],
};

export function canDonateTo(donor: BloodGroup, recipient: BloodGroup): boolean {
  return COMPATIBILITY[recipient].includes(donor);
}

export function compatibleDonors(recipient: BloodGroup): BloodGroup[] {
  return COMPATIBILITY[recipient];
}

export function formatDistance(km: number | null | undefined): string {
  if (km === null || km === undefined) return "Distance unknown";
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}

export function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "Not specified";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
