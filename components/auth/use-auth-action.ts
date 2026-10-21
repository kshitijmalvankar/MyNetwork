"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/auth/schemas";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/** useActionState that counts attempts, so captcha widgets can reset after each submit. */
export function useAuthAction(action: Action) {
  return useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await action(prev, formData);
    return { ...result, attempt: (prev.attempt ?? 0) + 1 };
  }, {});
}
