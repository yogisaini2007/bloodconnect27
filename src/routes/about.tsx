import { createFileRoute, Link } from "@tanstack/react-router";
import { Github, Linkedin, ArrowLeft, Mail } from "lucide-react";
import logo from "@/assets/bloodconnect-logo.png.asset.json";
import founder from "@/assets/yogesh-saini.png.asset.json";

const EMAIL = "yogisaini2007@gmail.com";
const GITHUB = "https://github.com/yogisaini2007";
const LINKEDIN =
  "https://www.linkedin.com/in/yogesh-saini-2678b9324?utm_source=share_via&utm_content=profile&utm_medium=member_android";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About BLOODCONNECT — Founder Yogesh Saini" },
      {
        name: "description",
        content:
          "BLOODCONNECT helps people find nearby blood donors quickly during emergencies. Meet founder Yogesh Saini and connect on GitHub or LinkedIn.",
      },
      { property: "og:title", content: "About BLOODCONNECT — Founder Yogesh Saini" },
      {
        property: "og:description",
        content:
          "The story behind BLOODCONNECT, a real-time platform connecting patients with nearby eligible blood donors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <main className="mx-auto min-h-screen max-w-md bg-background pb-10">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Link
          to="/"
          aria-label="Go back"
          className="-ml-2 flex size-10 items-center justify-center rounded-full transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-5 text-primary" />
        </Link>
        <h1 className="text-lg font-bold text-primary">About</h1>
      </header>

      <section className="px-4 py-6">
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
          <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-2xl bg-muted">
            <img src={logo.url} alt="BLOODCONNECT logo" className="size-14 object-contain" />
          </div>
          <h2 className="text-2xl font-extrabold text-primary">BloodConnect</h2>
          <p className="mx-auto mt-2 inline-block rounded-full bg-muted px-3 py-1 text-[11px] font-semibold text-muted-foreground">
            Version 1.0.0
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            BloodConnect is a platform that helps people find nearby blood donors quickly during
            emergencies. It connects donors, patients and hospitals to save lives through faster
            communication and location-based search.
          </p>

          <hr className="my-6 border-t-2 border-primary/70" />

          <h3 className="text-left text-base font-bold">Meet the Founder</h3>
          <img
            src={founder.url}
            alt="Yogesh Saini, founder of BloodConnect"
            className="mx-auto mt-4 size-24 rounded-full object-cover ring-4 ring-primary-soft"
            loading="lazy"
          />
          <p className="mt-3 text-lg font-bold">Yogesh Saini</p>
          <p className="text-xs font-semibold text-primary">Founder of BloodConnect</p>
          <blockquote className="mt-4 rounded-xl bg-muted p-4 text-left text-sm italic text-muted-foreground">
            “No one should lose their life because blood could not be found in time.”
          </blockquote>
        </div>

        <h3 className="mb-3 mt-6 text-base font-bold">Connect</h3>
        <div className="grid grid-cols-2 gap-3">
          <ConnectCard href={LINKEDIN} icon={<Linkedin className="size-5" />} label="LinkedIn" />
          <ConnectCard href={GITHUB} icon={<Github className="size-5" />} label="GitHub" />
        </div>
        <a
          href={`mailto:${EMAIL}`}
          className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-card px-4 py-4 text-primary transition-colors hover:bg-primary-soft"
        >
          <Mail className="size-5" aria-hidden />
          <span className="text-xs font-semibold text-foreground">{EMAIL}</span>
        </a>

        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          © 2026 Yogesh Saini. All rights reserved.
        </p>
        <p className="mt-1 text-center text-[11px] text-muted-foreground">
          Designed and developed with <span className="text-primary">♥</span> by Yogesh Saini
        </p>
      </section>
    </main>
  );
}

function ConnectCard({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="flex flex-col items-center gap-2 rounded-xl border border-primary/30 bg-card px-4 py-5 text-primary transition-colors hover:bg-primary-soft"
    >
      {icon}
      <span className="text-xs font-semibold text-foreground">{label}</span>
    </a>
  );
}
