import { randomId } from "./crypto";
import { getD1 } from "./runtime";

export type AuthAuditAction = "auth.register_success" | "auth.login_success" | "auth.password_reset_success";

export async function recordAuthAuditEvent(
  userId: string,
  action: AuthAuditAction,
  method: "msg91_otp" | "password_phone" | "password_email",
): Promise<void> {
  try {
    await getD1().prepare(
      `INSERT INTO audit_events (id, tenant_id, user_id, action, resource_type, resource_id, metadata_json, created_at)
       VALUES (?1, NULL, ?2, ?3, 'authentication', ?2, ?4, ?5)`,
    ).bind(randomId("aud"), userId, action, JSON.stringify({ method }), new Date().toISOString()).run();
  } catch {
    console.error(JSON.stringify({event:"auth.audit.failure",code:"d1_write_failed"}));
    // Authentication telemetry must never make a valid login fail.
  }
}
