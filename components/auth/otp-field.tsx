"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";

/** Six-digit authenticator code, submitted as `name`. Auto-submits the form when complete. */
export function OtpField({ name = "code", invalid, autoSubmit = true }: { name?: string; invalid?: boolean; autoSubmit?: boolean }) {
  return (
    <InputOTP
      name={name}
      maxLength={6}
      pattern={REGEXP_ONLY_DIGITS}
      autoComplete="one-time-code"
      inputMode="numeric"
      autoFocus
      aria-invalid={invalid || undefined}
      containerClassName="justify-center"
      onComplete={() => {
        if (!autoSubmit) return;
        const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
        input?.form?.requestSubmit();
      }}
    >
      <InputOTPGroup>
        <InputOTPSlot index={0} className="size-11 text-lg" />
        <InputOTPSlot index={1} className="size-11 text-lg" />
        <InputOTPSlot index={2} className="size-11 text-lg" />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} className="size-11 text-lg" />
        <InputOTPSlot index={4} className="size-11 text-lg" />
        <InputOTPSlot index={5} className="size-11 text-lg" />
      </InputOTPGroup>
    </InputOTP>
  );
}
