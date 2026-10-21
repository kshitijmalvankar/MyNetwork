"use client";

import { resetPassword } from "@/app/(auth)/actions";
import { AuthHeading } from "@/components/auth/auth-heading";
import { Errors, FormMessage, PasswordInput, SubmitButton } from "@/components/auth/form-bits";
import { useAuthAction } from "@/components/auth/use-auth-action";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PASSWORD_MIN } from "@/lib/auth/schemas";

export default function ResetPasswordPage() {
  const [state, action] = useAuthAction(resetPassword);
  const errors = state.fieldErrors ?? {};

  return (
    <>
      <AuthHeading title="Choose a new password" />
      <form action={action} noValidate>
        <FieldGroup>
          <FormMessage message={state.message} />
          <Field data-invalid={Boolean(errors.password) || undefined}>
            <FieldLabel htmlFor="password">New password</FieldLabel>
            <PasswordInput id="password" autoComplete="new-password" invalid={Boolean(errors.password)} />
            <FieldDescription>At least {PASSWORD_MIN} characters.</FieldDescription>
            <Errors errors={errors.password} />
          </Field>
          <Field data-invalid={Boolean(errors.confirm) || undefined}>
            <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
            <PasswordInput id="confirm" name="confirm" autoComplete="new-password" invalid={Boolean(errors.confirm)} />
            <Errors errors={errors.confirm} />
          </Field>
          <SubmitButton>Update password</SubmitButton>
        </FieldGroup>
      </form>
    </>
  );
}
