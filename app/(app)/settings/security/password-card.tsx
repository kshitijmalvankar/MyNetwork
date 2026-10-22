"use client";

import { startTransition, useRef } from "react";
import { Errors, FormMessage, PasswordInput } from "@/components/auth/form-bits";
import { useAuthAction } from "@/components/auth/use-auth-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { PASSWORD_MIN } from "@/lib/auth/schemas";
import { changePassword } from "../actions";
import { needsStepUp, useStepUp } from "@/components/security/step-up";

export function PasswordCard() {
  const { withStepUp, expire } = useStepUp();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useAuthAction(async (prev, formData) => {
    const res = await changePassword(prev, formData);
    if (needsStepUp(res)) expire();
    if (res.ok) formRef.current?.reset();
    return res;
  });
  const errors = state.fieldErrors ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>Use a long, unique password. We check new passwords against known breaches.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            withStepUp(() => startTransition(() => action(formData)));
          }}
        >
          <FieldGroup className="max-w-md">
            <FormMessage ok={state.ok} message={needsStepUp(state) ? "Please confirm it's you, then try again." : state.message} />
            <Field data-invalid={Boolean(errors.password) || undefined}>
              <FieldLabel htmlFor="new-password">New password</FieldLabel>
              <PasswordInput id="new-password" autoComplete="new-password" invalid={Boolean(errors.password)} />
              <FieldDescription>At least {PASSWORD_MIN} characters.</FieldDescription>
              <Errors errors={errors.password} />
            </Field>
            <Field data-invalid={Boolean(errors.confirm) || undefined}>
              <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
              <PasswordInput id="confirm-password" name="confirm" autoComplete="new-password" invalid={Boolean(errors.confirm)} />
              <Errors errors={errors.confirm} />
            </Field>
            <Button type="submit" className="w-fit px-5" disabled={pending}>
              {pending && <Spinner />} Change password
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
