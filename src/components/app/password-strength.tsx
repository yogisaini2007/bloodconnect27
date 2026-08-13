import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const RULES = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "One uppercase letter (A-Z)", test: (v: string) => /[A-Z]/.test(v) },
  { label: "One lowercase letter (a-z)", test: (v: string) => /[a-z]/.test(v) },
  { label: "One number (0-9)", test: (v: string) => /\d/.test(v) },
  { label: "One symbol (!@#$…)", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

const LEVELS = [
  { label: "Very weak", bar: "bg-destructive", text: "text-destructive" },
  { label: "Weak", bar: "bg-destructive", text: "text-destructive" },
  { label: "Fair", bar: "bg-warning", text: "text-warning" },
  { label: "Good", bar: "bg-warning", text: "text-warning" },
  { label: "Strong", bar: "bg-success", text: "text-success" },
  { label: "Very strong", bar: "bg-success", text: "text-success" },
] as const;

export function passwordScore(value: string) {
  return RULES.reduce((n, r) => n + (r.test(value) ? 1 : 0), 0);
}

/** Live strength meter + tips shown under a password field. */
export function PasswordStrength({ value }: { value: string }) {
  const score = passwordScore(value);
  const level = LEVELS[score] ?? LEVELS[0];

  return (
    <div className="space-y-2 rounded-xl bg-muted/60 p-3">
      <div className="flex items-center gap-2">
        <div className="flex h-1.5 flex-1 gap-1">
          {RULES.map((r, i) => (
            <span
              key={r.label}
              className={cn(
                "h-full flex-1 rounded-full transition-colors",
                i < score ? level.bar : "bg-muted-foreground/25",
              )}
            />
          ))}
        </div>
        <span className={cn("text-[11px] font-semibold", value ? level.text : "text-muted-foreground")}>
          {value ? level.label : "Password tips"}
        </span>
      </div>
      <ul className="grid gap-1">
        {RULES.map((r) => {
          const ok = r.test(value);
          return (
            <li
              key={r.label}
              className={cn(
                "flex items-center gap-1.5 text-[11px]",
                ok ? "text-success" : "text-muted-foreground",
              )}
            >
              {ok ? (
                <Check className="size-3.5 shrink-0" aria-hidden />
              ) : (
                <X className="size-3.5 shrink-0 opacity-60" aria-hidden />
              )}
              {r.label}
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        Tip: use a memorable phrase like <span className="font-semibold">Rakt@Daan2026!</span> —
        avoid your name, phone number or birth year.
      </p>
    </div>
  );
}
