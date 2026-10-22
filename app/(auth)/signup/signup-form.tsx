"use client";

import Link from "next/link";
import { signUp } from "@/app/(auth)/actions";
import { Errors, FormMessage, PasswordInput, SubmitButton } from "@/components/auth/form-bits";
import { Turnstile } from "@/components/auth/turnstile";
import { useAuthAction } from "@/components/auth/use-auth-action";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PASSWORD_MIN } from "@/lib/auth/schemas";

export function SignupForm() {
  const [state, action] = useAuthAction(signUp);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate>
      <FieldGroup>
        <FormMessage message={state.message} />
        <Field data-invalid={Boolean(errors.displayName) || undefined}>
          <FieldLabel htmlFor="displayName">
            Your name <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input id="displayName" name="displayName" autoComplete="name" className="h-10" defaultValue={state.values?.displayName} />
          <Errors errors={errors.displayName} />
        </Field>
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
        <Field data-invalid={Boolean(errors.password) || undefined}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <PasswordInput id="password" autoComplete="new-password" invalid={Boolean(errors.password)} />
          <FieldDescription>At least {PASSWORD_MIN} characters. A short phrase works well.</FieldDescription>
          <Errors errors={errors.password} />
        </Field>
        <Turnstile resetKey={state.attempt} />
        <SubmitButton>Create account</SubmitButton>
        <p className="text-center text-xs text-muted-foreground">
          By creating an account, you agree to the{" "}
          <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
            privacy policy
          </Link>
          .
        </p>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </FieldGroup>
    </form>
  );
}
