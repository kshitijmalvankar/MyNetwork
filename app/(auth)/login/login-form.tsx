"use client";

import Link from "next/link";
import { signIn } from "@/app/(auth)/actions";
import { Errors, FormMessage, PasswordInput, SubmitButton } from "@/components/auth/form-bits";
import { Turnstile } from "@/components/auth/turnstile";
import { useAuthAction } from "@/components/auth/use-auth-action";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action] = useAuthAction(signIn);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate>
      <FieldGroup>
        <FormMessage ok={!state.message && Boolean(notice)} message={state.message ?? notice} />
        <input type="hidden" name="next" value={next ?? ""} />
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
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link href="/forgot-password" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="password" autoComplete="current-password" invalid={Boolean(errors.password)} />
          <Errors errors={errors.password} />
        </Field>
        <Turnstile resetKey={state.attempt} />
        <SubmitButton>Sign in</SubmitButton>
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </FieldGroup>
    </form>
  );
}
