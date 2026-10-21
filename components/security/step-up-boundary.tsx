import { StepUpProvider } from "@/components/security/step-up";
import { createClient } from "@/lib/supabase/server";

/** Server wrapper that loads the user's authenticators for the "confirm it's you" dialog. */
export async function StepUpBoundary({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const factors = (data?.totp ?? []).map((f, i) => ({ id: f.id, name: f.friendly_name || `Authenticator ${i + 1}` }));
  return (
    <StepUpProvider hasMfa={factors.length > 0} factors={factors}>
      {children}
    </StepUpProvider>
  );
}
