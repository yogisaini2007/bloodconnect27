import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { ShieldX, Mail, LogOut } from "lucide-react";

export const SUPPORT_EMAIL = "connectblood27@gmail.com";

export function BannedGate({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const { data: profile } = useProfile(userId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!profile?.is_banned) return <>{children}</>;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <span className="flex size-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldX className="size-10" aria-hidden />
      </span>
      <div>
        <h1 className="text-xl font-bold">Account banned</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You have been banned from BloodConnect for violating our safety policy.
        </p>
      </div>

      <p className="w-full rounded-xl border border-border bg-card p-4 text-left text-xs leading-relaxed text-muted-foreground">
        <span className="mb-1 block font-semibold text-foreground">Reason</span>
        {profile.ban_reason || "Violation of the BloodConnect community guidelines."}
      </p>

      <p className="text-xs text-muted-foreground">
        If you think this is a mistake, please contact support with your registered number.
      </p>

      <Button asChild className="h-12 w-full">
        <a href={`mailto:${SUPPORT_EMAIL}?subject=BloodConnect%20ban%20appeal`}>
          <Mail className="mr-2 size-4" /> Contact support
        </a>
      </Button>
      <Button variant="outline" className="h-11 w-full" onClick={signOut}>
        <LogOut className="mr-2 size-4" /> Sign out
      </Button>
    </div>
  );
}
