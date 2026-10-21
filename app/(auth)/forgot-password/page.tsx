"use client";

import Link from "next/link";
import { requestPasswordReset } from "@/app/(auth)/actions";
import { AuthHeading } from "@/components/auth/auth-heading";
import { Errors, FormMessage, SubmitButton } from "@/components/auth/form-bits";
import { Turnstile } from "@/components/auth/turnstile";
import { useAuthAction } from "@/components/auth/use-auth-action";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [state, action] = useAuthAction(requestPasswordReset);
  const errors = state.fieldErrors ?? {};

  return (
    <>
      <AuthHeading title="Reset your password" description="We'll email you a link to choose a new one." />
      <form action={action} noValidate>
        <FieldGroup>
          <FormMessage ok={state.ok} message={state.message} />
          <Field data-invalid={Boolean(errors.email) || undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              className="h-10"
              defaultValue={state.values?.email}
              aria-invalid={Boolean(errors.email) || undefined}
            />
            <Errors errors={errors.email} />
          </Field>
          <Turnstile resetKey={state.attempt} />
          <SubmitButton>Send reset link</SubmitButton>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
        </FieldGroup>
      </form>
    </>
  );
}
