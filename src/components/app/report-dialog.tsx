import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Reason = Database["public"]["Enums"]["report_reason"];

export const REPORT_REASONS: { value: Reason; label: string; hint: string; severe?: boolean }[] = [
  {
    value: "fake_info",
    label: "Fake information",
    hint: "Fake blood group, location, identity or emergency request",
    severe: true,
  },
  {
    value: "fraud_scam",
    label: "Fraud or scam",
    hint: "Asking money for blood, payment demands, phishing links",
    severe: true,
  },
  { value: "harassment", label: "Harassment or abuse", hint: "Abusive language, threats, bullying" },
  { value: "spam", label: "Spam", hint: "Repeated messages, bulk promotion, unrelated ads" },
  {
    value: "illegal_blood",
    label: "Illegal blood activity",
    hint: "Selling or buying blood, misuse of the donation system",
    severe: true,
  },
  {
    value: "impersonation",
    label: "Impersonation",
    hint: "Falsely claiming to be a doctor, hospital, blood bank or NGO",
    severe: true,
  },
  {
    value: "platform_manipulation",
    label: "Fake accounts / manipulation",
    hint: "Multiple accounts, ban evasion, false reporting of others",
  },
  {
    value: "harmful_content",
    label: "Harmful or unsafe content",
    hint: "Violence, threats, dangerous medical instructions",
    severe: true,
  },
  { value: "other", label: "Something else", hint: "Any other community guideline violation" },
];

export function ReportDialog({
  reportedUserId,
  reportedName,
  requestId,
  variant = "icon",
}: {
  reportedUserId: string;
  reportedName?: string | null;
  requestId?: string;
  variant?: "icon" | "button";
}) {
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);

  if (!userId || userId === reportedUserId) return null;

  async function submit() {
    if (!reason || saving) return;
    setSaving(true);
    const { error } = await supabase.from("user_reports").insert({
      reporter_id: userId!,
      reported_user_id: reportedUserId,
      request_id: requestId ?? null,
      reason,
      details: details.trim().slice(0, 1000),
    });
    setSaving(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "You have already reported this account."
          : "Could not send the report. Please try again.",
      );
      return;
    }
    setOpen(false);
    setReason(null);
    setDetails("");
    toast.success("Report submitted. Our safety team will review it.");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <button
            type="button"
            aria-label="Report this account"
            className="flex size-10 items-center justify-center rounded-full bg-primary-dark/40 text-current"
          >
            <Flag className="size-4" />
          </button>
        ) : (
          <Button variant="outline" className="h-11 w-full text-destructive">
            <Flag className="mr-2 size-4" /> Report this account
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report {reportedName || "this account"}</DialogTitle>
          <DialogDescription>
            Reports are confidential. False reporting is itself a violation and can get your own
            account restricted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setReason(r.value)}
              className={cn(
                "w-full rounded-xl border p-3 text-left transition-colors",
                reason === r.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/60",
              )}
            >
              <span className="block text-sm font-semibold">{r.label}</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">{r.hint}</span>
            </button>
          ))}
        </div>

        <Textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="What happened? Add any detail that helps us review (optional)."
        />

        <Button className="h-11 w-full" disabled={!reason || saving} onClick={submit}>
          {saving ? "Sending…" : "Submit report"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
