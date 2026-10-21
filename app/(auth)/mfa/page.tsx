import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheckIcon } from "lucide-react";
import { safeNext } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { MfaForm } from "./mfa-form";

export const metadata: Metadata = { title: "Two-factor verification" };

export default async function MfaPage({ searchParams }: PageProps<"/mfa">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : undefined);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");

  const { data } = await supabase.auth.mfa.listFactors();
  const factors = (data?.totp ?? []).map((f, i) => ({ id: f.id, name: f.friendly_name || `Authenticator ${i + 1}` }));
  if (factors.length === 0) redirect(next);

  return (
    <div className="space-y-8">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-subtle text-brand">
          <ShieldCheckIcon className="size-7" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Enter your code</h1>
        <p className="text-sm text-muted-foreground">Open your authenticator app and enter the 6-digit code for MyNetwork.</p>
      </div>
      <MfaForm factors={factors} next={next} />
      <form action="/auth/signout" method="post" className="text-center">
        <button type="submit" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Use a different account
        </button>
      </form>
    </div>
  );
}
