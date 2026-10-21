"use client";

import { createContext, use, useRef, useState } from "react";
import { ShieldCheckIcon } from "lucide-react";
import { Errors, FormMessage, PasswordInput, SubmitButton } from "@/components/auth/form-bits";
import { OtpField } from "@/components/auth/otp-field";
import { Turnstile } from "@/components/auth/turnstile";
import { useAuthAction } from "@/components/auth/use-auth-action";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import type { FormState } from "@/lib/auth/schemas";
import { stepUp } from "../actions";

type Ctx = {
  /** Runs `fn` now if recently confirmed, otherwise after the user re-enters their password. */
  withStepUp: (fn: () => void | Promise<void>) => void;
  /** Call when the server says step-up has expired. */
  expire: () => void;
};

const StepUpContext = createContext<Ctx | null>(null);

export function useStepUp() {
  const ctx = use(StepUpContext);
  if (!ctx) throw new Error("useStepUp must be used inside <StepUpProvider>");
  return ctx;
}

export function needsStepUp(state: FormState) {
  return Boolean(state.fieldErrors?.stepUp);
}

// Slightly shorter than the server's 5-minute window, so the client asks first.
const CLIENT_TTL_MS = 4 * 60 * 1000;

export function StepUpProvider({
  hasMfa,
  factors,
  children,
}: {
  hasMfa: boolean;
  factors: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const confirmedAt = useRef(0);
  const pending = useRef<(() => void | Promise<void>) | null>(null);

  const withStepUp: Ctx["withStepUp"] = (fn) => {
    if (Date.now() - confirmedAt.current < CLIENT_TTL_MS) {
      void fn();
      return;
    }
    pending.current = fn;
    setOpen(true);
  };

  const expire = () => {
    confirmedAt.current = 0;
  };

  return (
    <StepUpContext value={{ withStepUp, expire }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-brand-subtle text-brand">
              <ShieldCheckIcon className="size-5" />
            </div>
            <DialogTitle>Confirm it&apos;s you</DialogTitle>
            <DialogDescription>
              {hasMfa ? "Enter your password and a code from your authenticator." : "Enter your password to continue."}
            </DialogDescription>
          </DialogHeader>
          {open && (
            <StepUpForm
              hasMfa={hasMfa}
              factorId={factors[0]?.id}
              onSuccess={() => {
                confirmedAt.current = Date.now();
                setOpen(false);
                const fn = pending.current;
                pending.current = null;
                if (fn) void fn();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </StepUpContext>
  );
}

function StepUpForm({ hasMfa, factorId, onSuccess }: { hasMfa: boolean; factorId?: string; onSuccess: () => void }) {
  const [state, action] = useAuthAction(async (prev, formData) => {
    const result = await stepUp(prev, formData);
    if (result.ok) onSuccess();
    return result;
  });
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate>
      <FieldGroup>
        <FormMessage message={state.message} />
        <Field data-invalid={Boolean(errors.password) || undefined}>
          <FieldLabel htmlFor="stepup-password">Password</FieldLabel>
          <PasswordInput id="stepup-password" autoComplete="current-password" invalid={Boolean(errors.password)} />
          <Errors errors={errors.password} />
        </Field>
        {hasMfa && (
          <Field data-invalid={Boolean(errors.code) || undefined}>
            <FieldLabel>Authenticator code</FieldLabel>
            <input type="hidden" name="factorId" value={factorId ?? ""} />
            <OtpField key={state.attempt} autoSubmit={false} invalid={Boolean(errors.code)} />
            <Errors errors={errors.code} />
          </Field>
        )}
        <Turnstile resetKey={state.attempt} />
        <SubmitButton>Confirm</SubmitButton>
      </FieldGroup>
    </form>
  );
}
