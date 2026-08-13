import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrength } from "@/components/app/password-strength";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import logo from "@/assets/bloodconnect-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — BLOODCONNECT" },
      {
        name: "description",
        content:
          "Sign in to BLOODCONNECT to send emergency blood requests and respond to nearby donors.",
      },
      { property: "og:title", content: "Sign in — BLOODCONNECT" },
      {
        property: "og:description",
        content: "Emergency blood donation matching. Sign in to request or donate blood.",
      },
    ],
  }),
  component: AuthPage,
});

type Method = "password" | "otp";
type Channel = "email" | "phone";

const RESEND_SECONDS = 45;

function AuthPage() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<Method>("password");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentConfirmation, setSentConfirmation] = useState(false);

  // OTP state
  const [channel, setChannel] = useState<Channel>("email");
  const [otpEmail, setOtpEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldown]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!email.trim() || password.length < 6) {
      toast.error("Enter a valid email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setSentConfirmation(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
      void navigate({ to: "/home", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  function normalizedPhone() {
    const raw = phone.replace(/[^\d+]/g, "");
    return raw.startsWith("+") ? raw : `+${raw}`;
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy || cooldown > 0) return;
    if (channel === "email" && !otpEmail.trim().includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (channel === "phone" && normalizedPhone().length < 8) {
      toast.error("Enter your mobile number with country code, e.g. +91 98765 43210.");
      return;
    }
    setBusy(true);
    const { error } =
      channel === "email"
        ? await supabase.auth.signInWithOtp({
            email: otpEmail.trim(),
            options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
          })
        : await supabase.auth.signInWithOtp({
            phone: normalizedPhone(),
            options: { shouldCreateUser: true },
          });
    setBusy(false);
    if (error) {
      toast.error(
        channel === "phone"
          ? "Could not send the SMS code. SMS sign-in must be enabled in the backend auth settings."
          : error.message,
      );
      return;
    }
    setCodeSent(true);
    setCode("");
    setCooldown(RESEND_SECONDS);
    toast.success(channel === "email" ? "Code sent to your email" : "Code sent by SMS");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (code.trim().length !== 6) {
      toast.error("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    const { error } =
      channel === "email"
        ? await supabase.auth.verifyOtp({
            email: otpEmail.trim(),
            token: code.trim(),
            type: "email",
          })
        : await supabase.auth.verifyOtp({
            phone: normalizedPhone(),
            token: code.trim(),
            type: "sms",
          });
    setBusy(false);
    if (error) {
      toast.error("That code is invalid or expired. Request a new one.");
      return;
    }
    void navigate({ to: "/home", replace: true });
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/home", replace: true });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-background px-6 py-10">
      <div className="mb-8 text-center">
        <img src={logo.url} alt="BloodConnect logo" className="mx-auto mb-4 h-24 w-auto" />
        <h1 className="sr-only">BloodConnect</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find Blood Donors Near You, Save Lives.
        </p>
      </div>

      {sentConfirmation ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
          <h2 className="text-base font-semibold">Check your email</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to {email}. Confirm it, then come back and sign in.
          </p>
          <Button
            variant="outline"
            className="mt-5 w-full"
            onClick={() => {
              setSentConfirmation(false);
              setMode("signin");
            }}
          >
            Back to sign in
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
            {(
              [
                ["password", "Password"],
                ["otp", "OTP"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMethod(value);
                  setCodeSent(false);
                }}
                className={cn(
                  "rounded-full px-3 py-2 text-sm font-semibold transition-colors",
                  method === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {method === "password" ? (
            <form onSubmit={handleEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  maxLength={255}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-12"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  maxLength={72}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="h-12"
                  required
                  aria-describedby={mode === "signup" ? "password-tips" : undefined}
                />
                {mode === "signup" && (
                  <div id="password-tips">
                    <PasswordStrength value={password} />
                  </div>
                )}
              </div>
              <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                {mode === "signup" ? "Create account" : "Sign in"}
              </Button>
            </form>
          ) : codeSent ? (
            <form onSubmit={verifyCode} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We sent a 6-digit code to{" "}
                <span className="font-semibold text-foreground">
                  {channel === "email" ? otpEmail : normalizedPhone()}
                </span>
                .
              </p>
              <div className="space-y-2">
                <Label htmlFor="code">Verification code</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="h-12 text-center text-xl font-bold tracking-[0.4em]"
                />
              </div>
              <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                Verify and continue
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => setCodeSent(false)}
                >
                  Change {channel === "email" ? "email" : "number"}
                </button>
                <button
                  type="button"
                  disabled={cooldown > 0 || busy}
                  onClick={() => void sendCode()}
                  className="font-semibold text-primary underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={sendCode} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["email", "Email"],
                    ["phone", "Mobile number"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setChannel(value)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                      channel === value
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {channel === "email" ? (
                <div className="space-y-2">
                  <Label htmlFor="otpEmail">Email address</Label>
                  <Input
                    id="otpEmail"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    maxLength={255}
                    value={otpEmail}
                    onChange={(e) => setOtpEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-12"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="otpPhone">Mobile number</Label>
                  <Input
                    id="otpPhone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={20}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="h-12"
                  />
                  <p className="text-xs text-muted-foreground">
                    Include your country code. SMS codes need the SMS provider enabled in the
                    backend auth settings.
                  </p>
                </div>
              )}

              <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                Send code
              </Button>
            </form>
          )}

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-12 w-full text-base"
            onClick={handleGoogle}
            disabled={busy}
          >
            Continue with Google
          </Button>

          {method === "password" && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signup" ? "Already have an account?" : "New to BLOODCONNECT?"}{" "}
              <button
                type="button"
                className="font-semibold text-primary underline-offset-4 hover:underline"
                onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              >
                {mode === "signup" ? "Sign in" : "Create one"}
              </button>
            </p>
          )}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        BLOODCONNECT helps coordinate donors. It is not a medical service.{" "}
        <Link to="/" className="underline underline-offset-4">
          Learn more
        </Link>
      </p>
    </main>
  );
}
