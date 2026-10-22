import type { Metadata } from "next";
import { ActivityIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { PasswordCard } from "./password-card";
import { StepUpProvider } from "@/components/security/step-up";
import { TwoFactorCard } from "./two-factor-card";

export const metadata: Metadata = { title: "Security" };

const ACTION_LABELS: Record<string, string> = {
  "auth.signup": "Account created",
  "auth.login": "Signed in",
  "auth.login_failed": "Failed sign-in attempt",
  "auth.logout": "Signed out",
  "auth.password_reset_requested": "Password reset requested",
  "auth.password_changed": "Password changed",
  "auth.mfa_enrolled": "Authenticator added",
  "auth.mfa_removed": "Authenticator removed",
  "auth.mfa_verified": "Two-factor code accepted",
  "auth.mfa_failed": "Two-factor code rejected",
  "auth.step_up": "Identity confirmed",
  "data.export": "Contacts downloaded",
  "contact.deleted": "Contact deleted",
  "contact.merged": "Contacts merged",
};

export default async function SecurityPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: factorData }, { data: activity }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase
      .from("audit_log")
      .select("id, action, created_at, user_agent")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const factors = (factorData?.totp ?? []).map((f, i) => ({
    id: f.id,
    name: f.friendly_name || `Authenticator ${i + 1}`,
    createdAt: f.created_at,
  }));

  return (
    <StepUpProvider hasMfa={factors.length > 0} factors={factors}>
      <TwoFactorCard factors={factors} />
      <PasswordCard />
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ActivityIcon className="size-4 text-brand" /> Recent activity
          </CardTitle>
          <CardDescription>Sign-ins and security changes on your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {activity && activity.length > 0 ? (
            <ul className="divide-y">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <span className={a.action.endsWith("failed") ? "text-destructive" : undefined}>
                    {ACTION_LABELS[a.action] ?? a.action}
                  </span>
                  <time dateTime={a.created_at} className="shrink-0 text-muted-foreground" title={new Date(a.created_at).toLocaleString()}>
                    {timeAgo(a.created_at)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          )}
        </CardContent>
      </Card>
    </StepUpProvider>
  );
}
