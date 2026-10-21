"use client";

import { verifyMfa } from "@/app/(auth)/actions";
import { Errors, FormMessage, SubmitButton } from "@/components/auth/form-bits";
import { OtpField } from "@/components/auth/otp-field";
import { useAuthAction } from "@/components/auth/use-auth-action";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function MfaForm({ factors, next }: { factors: { id: string; name: string }[]; next: string }) {
  const [state, action] = useAuthAction(verifyMfa);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate>
      <FieldGroup>
        <FormMessage message={state.message} />
        <input type="hidden" name="next" value={next} />
        {factors.length > 1 ? (
          <Field>
            <FieldLabel htmlFor="factorId">Authenticator</FieldLabel>
            <Select name="factorId" defaultValue={factors[0].id}>
              <SelectTrigger id="factorId" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {factors.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="factorId" value={factors[0]?.id ?? ""} />
        )}
        <Field data-invalid={Boolean(errors.code) || undefined} className="items-center">
          <FieldLabel htmlFor="code" className="sr-only">
            Code
          </FieldLabel>
          <OtpField key={state.attempt} invalid={Boolean(errors.code)} />
          <Errors errors={errors.code} />
        </Field>
        <SubmitButton>Verify</SubmitButton>
      </FieldGroup>
    </form>
  );
}
