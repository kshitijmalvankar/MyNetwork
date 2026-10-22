import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import { adminClient } from "@/lib/supabase/admin";
import { getRequestInfo } from "@/lib/request";

export type AuditAction =
  | "auth.signup"
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.password_reset_requested"
  | "auth.password_changed"
  | "auth.mfa_enrolled"
  | "auth.mfa_removed"
  | "auth.mfa_verified"
  | "auth.mfa_failed"
  | "auth.step_up"
  | "data.export"
  | "account.deleted"
  | "contact.deleted"
  | "contact.merged";

type AuditEvent = {
  userId: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, Json>;
};

/** Append to the audit log. Never throws: auditing must not break the action it records. */
export async function audit(event: AuditEvent): Promise<void> {
  try {
    const { ipHash, userAgent } = await getRequestInfo();
    const { error } = await adminClient()
      .from("audit_log")
      .insert({
        user_id: event.userId,
        action: event.action,
        target_type: event.targetType ?? null,
        target_id: event.targetId ?? null,
        ip_hash: ipHash,
        user_agent: userAgent,
        metadata: event.metadata ?? {},
      });
    if (error) console.error("[audit] insert failed", error.message);
  } catch (err) {
    console.error("[audit] failed", err);
  }
}
