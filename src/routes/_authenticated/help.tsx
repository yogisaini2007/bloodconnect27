import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/app/shell";
import { BottomNav } from "@/components/app/bottom-nav";
import { SUPPORT_EMAIL } from "@/components/app/banned-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LifeBuoy, Mail, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({
    meta: [
      { title: "Help Center — BLOODCONNECT Support & Complaints" },
      {
        name: "description",
        content:
          "Report a problem, raise a complaint about a user, and read the BloodConnect account ban and safety policy.",
      },
      { property: "og:title", content: "BLOODCONNECT Help Center" },
      {
        property: "og:description",
        content: "Support, complaints and the BloodConnect account ban & safety policy.",
      },
    ],
  }),
  component: HelpCenter,
});

const CATEGORIES = [
  "App problem / bug",
  "Complaint about a user",
  "Account or login issue",
  "Blood request issue",
  "Ban appeal",
  "Other",
] as const;

const BAN_CONDITIONS: [string, string][] = [
  ["Fake information", "Fake blood group, location, donor details or emergency request."],
  ["Fraud or scam", "Asking money for blood, fake donation requests, phishing links."],
  ["Harassment & abuse", "Abusive language, threats, bullying, repeated unwanted contact."],
  ["Spam", "Repeated messages, bulk promotion or unrelated advertising."],
  ["Illegal blood activity", "Buying or selling blood, misusing the donation system."],
  ["Impersonation", "Claiming to be a doctor, hospital, blood bank or NGO falsely."],
  ["Platform manipulation", "Multiple fake accounts, ban evasion, false reports on others."],
  ["Harmful content", "Violence, threats or unsafe medical instructions."],
];

function HelpCenter() {
  const { userId, user } = useAuth();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const tickets = useQuery({
    queryKey: ["my-tickets", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || saving) return;
    if (subject.trim().length < 4 || message.trim().length < 10) {
      toast.error("Please add a short subject and describe the issue.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: userId,
      category,
      subject: subject.trim().slice(0, 120),
      message: message.trim().slice(0, 2000),
      contact_email: user?.email ?? "",
    });
    setSaving(false);
    if (error) {
      toast.error("Could not send your request. Please try again.");
      return;
    }
    setSubject("");
    setMessage("");
    void queryClient.invalidateQueries({ queryKey: ["my-tickets", userId] });
    toast.success("Thanks! Your request has been sent to our support team.");
  }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-24">
      <AppHeader title="Help Center" subtitle="Support, complaints & safety" tone="brand" />

      <div className="space-y-5 px-4 py-5">
        <section className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
          <LifeBuoy className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Koi dikkat hai ya kisi user ki galat activity report karni hai? Neeche form bharein — har
            complaint humari safety team review karti hai.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-bold">Raise a complaint or report a problem</h2>
          <form className="mt-3 space-y-3" onSubmit={submit}>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    category === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            <Input
              value={subject}
              maxLength={120}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />
            <Textarea
              value={message}
              maxLength={2000}
              rows={5}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the issue. If it is about a user, add their name, phone or the hospital in the request."
            />
            <Button type="submit" className="h-11 w-full" disabled={saving}>
              {saving ? "Sending…" : "Submit to support"}
            </Button>
          </form>
        </section>

        {(tickets.data?.length ?? 0) > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold">Your requests</h2>
            {tickets.data!.map((t) => (
              <article key={t.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{t.subject}</p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      t.status === "resolved" || t.status === "closed"
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning",
                    )}
                  >
                    {t.status.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.message}</p>
                {t.admin_reply && (
                  <p className="mt-2 rounded-lg bg-muted p-2 text-xs">
                    <span className="font-semibold">Support: </span>
                    {t.admin_reply}
                  </p>
                )}
              </article>
            ))}
          </section>
        )}

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <ShieldAlert className="size-4 text-primary" aria-hidden /> Account ban & safety policy
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Report → review → valid report count → action. 1–2 valid reports means a warning, 3–4
            puts the account under restriction and manual review, and 5 or more valid reports means a
            permanent ban. Serious fraud, illegal blood trade, impersonation or threats are treated
            as valid immediately.
          </p>
          <Accordion type="single" collapsible className="mt-2">
            {BAN_CONDITIONS.map(([title, body]) => (
              <AccordionItem key={title} value={title}>
                <AccordionTrigger className="text-sm">{title}</AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground">{body}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            A banned account cannot sign in, message anyone, or create requests; its active requests
            are cancelled. Appeals can be sent to support.
          </p>
        </section>

        <Button asChild variant="outline" className="h-11 w-full">
          <a href={`mailto:${SUPPORT_EMAIL}?subject=BloodConnect%20support`}>
            <Mail className="mr-2 size-4" /> Email {SUPPORT_EMAIL}
          </a>
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}
