import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { HeartPulse, MapPin, Siren, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BLOODCONNECT — Emergency Blood Donor Matching" },
      {
        name: "description",
        content:
          "Find nearby, eligible blood donors in seconds. Broadcast an SOS, match by blood group and distance, and coordinate directly with donors.",
      },
      { property: "og:title", content: "BLOODCONNECT — Emergency Blood Donor Matching" },
      {
        property: "og:description",
        content:
          "Real-time, location-based blood donation platform connecting patients in urgent need with nearby eligible donors.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <section className="flex flex-1 flex-col justify-center bg-primary px-6 py-14 text-primary-foreground">
        <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary-dark/40">
          <HeartPulse className="size-8" aria-hidden />
        </div>
        <h1 className="text-3xl font-bold leading-tight tracking-tight">
          Blood, found fast.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-primary-foreground/85">
          BLOODCONNECT broadcasts an emergency request to every eligible donor near the hospital —
          matched by blood group, distance and donation eligibility.
        </p>
        <Button asChild variant="secondary" className="mt-8 h-12 w-full text-base font-semibold">
          <Link to="/auth">Get started</Link>
        </Button>
      </section>

      <section className="space-y-4 px-6 py-8">
        <Feature
          icon={<Siren className="size-5" />}
          title="One-tap SOS"
          text="Blood group, units, urgency and hospital — broadcast in under a minute."
        />
        <Feature
          icon={<MapPin className="size-5" />}
          title="Radius matching"
          text="Only eligible donors within 5–50 km are alerted, with live distance shown."
        />
        <Feature
          icon={<MessageCircle className="size-5" />}
          title="Call and chat"
          text="Talk to donors directly once they accept, and share ward details in-app."
        />
        <p className="pt-2 text-center text-xs text-muted-foreground">
          Already registered?{" "}
          <Link to="/auth" className="font-semibold text-primary underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-card p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{text}</span>
      </span>
    </div>
  );
}
