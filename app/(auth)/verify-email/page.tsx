import Link from "next/link";
import type { Metadata } from "next";
import { MailCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Check your email" };

export default function VerifyEmailPage() {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-subtle text-brand">
        <MailCheckIcon className="size-7" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent you a confirmation link. Open it on any device to activate your account, then sign in.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Nothing arrived? Check your spam folder. If you already have an account, sign in or reset your password instead.
      </p>
      <Button asChild variant="outline" className="w-full">
        <Link href="/login">Back to sign in</Link>
      </Button>
    </div>
  );
}
