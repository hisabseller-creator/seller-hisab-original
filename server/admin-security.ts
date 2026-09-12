import { decryptJson, encryptJson, randomId, sha256 } from "./crypto";
import { getD1, runtimeEnv } from "./runtime";
import { verifyPassword } from "./password";
import { buildTotpUri, generateTotpSecret, matchTotpStep } from "./totp";

export const ADMIN_PASSWORD_HISTORY = 10;
export const ADMIN_PASSWORD_MIN_AGE_MS = 24 * 60 * 60 * 1000;
export const ADMIN_PASSWORD_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
export const MAX_PASSWORD_FAILURES = 10;
export const PASSWORD_LOCKOUT_MS = 30 * 60 * 1000;
const RECOVERY_CODE_COUNT = 10;
const PENDING_MFA_MAX_AGE_MS = 15 * 60 * 1000;

type MfaRow = {
  secretCiphertext: string | null;
  secretIv: string | null;
  secretKeyVersion: string | null;
  pendingSecretCiphertext: string | null;
  pendingSecretIv: string | null;
  pendingKeyVersion: string | null;
  pendingCreatedAt: string | null;
  enabledAt: string | null;
  lastTotpStep: number | null;
};

type SecurityState = {
  failedPasswordAttempts: number;
  lockedUntil: number | null;
  passwordChangedAt: string | null;
  securityVersion: number;
};

function mfaKeyForVersion(version: string): string {
  const env = runtimeEnv();
  const root = version === "v2" ? env.CONNECTOR_ENCRYPTION_KEY_V2 : env.CONNECTOR_ENCRYPTION_KEY;
  if (!root || root.length < 32) throw new Error("MFA encryption key material is unavailable.");
  return `${root}:sellerhisab-admin-mfa:v1`;
}

function currentMfaKey(): { version: "v1" | "v2"; secret: string } {
  const env = runtimeEnv();
  const version: "v1" | "v2" = env.CONNECTOR_ENCRYPTION_KEY_V2 ? "v2" : "v1";
  return { version, secret: mfaKeyForVersion(version) };
}

async function readMfa(userId: string): Promise<MfaRow | null> {
  return getD1().prepare(`
    SELECT secret_ciphertext AS secretCiphertext,
           secret_iv AS secretIv,
           secret_key_version AS secretKeyVersion,
           pending_secret_ciphertext AS pendingSecretCiphertext,
           pending_secret_iv AS pendingSecretIv,
           pending_key_version AS pendingKeyVersion,
           pending_created_at AS pendingCreatedAt,
           enabled_at AS enabledAt,
           last_totp_step AS lastTotpStep
    FROM admin_mfa_settings WHERE user_id=?1
  `).bind(userId).first<MfaRow>();
}

async function decryptMfaSecret(ciphertext: string, iv: string, version: string): Promise<string> {
  const payload = await decryptJson<{ secret: string }>(ciphertext, iv, mfaKeyForVersion(version));
  if (!payload.secret) throw new Error("MFA secret payload is invalid.");
  return payload.secret;
}

export async function getAdminMfaStatus(userId: string) {
  const row = await readMfa(userId);
  const password = await getAdminPasswordAgeState(userId);
  return {
    enabled: Boolean(row?.enabledAt && row.secretCiphertext && row.secretIv && row.secretKeyVersion),
    pending: Boolean(row?.pendingCreatedAt && row.pendingSecretCiphertext),
    enabledAt: row?.enabledAt ?? null,
    passwordChangedAt: password.passwordChangedAt,
    passwordExpired: password.expired,
  };
}

export async function startAdminMfaEnrollment(userId: string, accountLabel: string, allowRotation = false) {
  const existing = await readMfa(userId);
  if (existing?.enabledAt && !allowRotation) throw new Error("MFA is already enabled.");
  const secret = generateTotpSecret();
  const key = currentMfaKey();
  const encrypted = await encryptJson({ secret }, key.secret);
  const now = new Date().toISOString();
  await getD1().prepare(`
    INSERT INTO admin_mfa_settings
      (user_id,pending_secret_ciphertext,pending_secret_iv,pending_key_version,pending_created_at,created_at,updated_at)
    VALUES (?1,?2,?3,?4,?5,?5,?5)
    ON CONFLICT(user_id) DO UPDATE SET
      pending_secret_ciphertext=excluded.pending_secret_ciphertext,
      pending_secret_iv=excluded.pending_secret_iv,
      pending_key_version=excluded.pending_key_version,
      pending_created_at=excluded.pending_created_at,
      updated_at=excluded.updated_at
  `).bind(userId, encrypted.ciphertext, encrypted.iv, key.version, now).run();
  await recordSecurityAudit(userId, existing?.enabledAt ? "security.mfa_rotation_started" : "security.mfa_enrollment_started");
  return { secret, otpauthUri: buildTotpUri(secret, accountLabel) };
}

export async function confirmAdminMfaEnrollment(userId: string, code: string): Promise<string[]> {
  const row = await readMfa(userId);
  if (!row?.pendingSecretCiphertext || !row.pendingSecretIv || !row.pendingKeyVersion || !row.pendingCreatedAt) {
    throw new Error("No MFA enrollment is pending.");
  }
  if (Date.now() - Date.parse(row.pendingCreatedAt) > PENDING_MFA_MAX_AGE_MS) throw new Error("MFA enrollment expired. Start again.");
  const secret = await decryptMfaSecret(row.pendingSecretCiphertext, row.pendingSecretIv, row.pendingKeyVersion);
  const step = await matchTotpStep(secret, code);
  if (step === null) throw new Error("Authenticator code is invalid.");

  const now = new Date().toISOString();
  const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () => formatRecoveryCode(generateTotpSecret().slice(0, 12)));
  const db = getD1();
  const statements = [
    db.prepare(`
      UPDATE admin_mfa_settings SET
        secret_ciphertext=pending_secret_ciphertext,
        secret_iv=pending_secret_iv,
        secret_key_version=pending_key_version,
        enabled_at=?2,
        last_totp_step=?3,
        pending_secret_ciphertext=NULL,
        pending_secret_iv=NULL,
        pending_key_version=NULL,
        pending_created_at=NULL,
        updated_at=?2
      WHERE user_id=?1 AND pending_secret_ciphertext IS NOT NULL
    `).bind(userId, now, step),
    db.prepare("DELETE FROM admin_mfa_recovery_codes WHERE user_id=?1").bind(userId),
  ];
  for (const recoveryCode of recoveryCodes) {
    statements.push(db.prepare(`
      INSERT INTO admin_mfa_recovery_codes (id,user_id,code_hash,created_at,used_at)
      VALUES (?1,?2,?3,?4,NULL)
    `).bind(randomId("mrc"), userId, await recoveryCodeHash(userId, recoveryCode), now));
  }
  await db.batch(statements);
  await bumpSecurityVersion(userId);
  await recordSecurityAudit(userId, row.enabledAt ? "security.mfa_rotated" : "security.mfa_enabled");
  return recoveryCodes;
}

export async function verifyAdminSecondFactor(userId: string, code: string): Promise<"totp" | "recovery" | null> {
  const normalized = code.trim();
  const row = await readMfa(userId);
  if (!row?.enabledAt || !row.secretCiphertext || !row.secretIv || !row.secretKeyVersion) return null;

  if (/^\d{6}$/.test(normalized.replace(/\s+/g, ""))) {
    const secret = await decryptMfaSecret(row.secretCiphertext, row.secretIv, row.secretKeyVersion);
    const step = await matchTotpStep(secret, normalized);
    if (step === null) return null;
    const consumed = await getD1().prepare(`
      UPDATE admin_mfa_settings SET last_totp_step=?2,updated_at=?3
      WHERE user_id=?1 AND enabled_at IS NOT NULL AND (last_totp_step IS NULL OR last_totp_step < ?2)
    `).bind(userId, step, new Date().toISOString()).run();
    if (consumed.meta.changes !== 1) return null;
    await recordSecurityAudit(userId, "security.mfa_verified", { method: "totp" });
    return "totp";
  }

  const hash = await recoveryCodeHash(userId, normalized);
  const usedAt = new Date().toISOString();
  const consumed = await getD1().prepare(`
    UPDATE admin_mfa_recovery_codes SET used_at=?3
    WHERE id=(SELECT id FROM admin_mfa_recovery_codes WHERE user_id=?1 AND code_hash=?2 AND used_at IS NULL LIMIT 1)
      AND used_at IS NULL
  `).bind(userId, hash, usedAt).run();
  if (consumed.meta.changes !== 1) return null;
  await recordSecurityAudit(userId, "security.mfa_verified", { method: "recovery" });
  return "recovery";
}

export async function getSecurityVersion(userId: string): Promise<number> {
  await ensureSecurityState(userId);
  const row = await getD1().prepare("SELECT security_version AS securityVersion FROM user_security_state WHERE user_id=?1")
    .bind(userId).first<{ securityVersion: number }>();
  return Number(row?.securityVersion ?? 1);
}

export async function getLoginLockState(userId: string): Promise<{ locked: boolean; retryAfterSeconds: number }> {
  await ensureSecurityState(userId);
  const row = await getD1().prepare("SELECT locked_until AS lockedUntil FROM user_security_state WHERE user_id=?1")
    .bind(userId).first<{ lockedUntil: number | null }>();
  const lockedUntil = Number(row?.lockedUntil ?? 0);
  if (lockedUntil > Date.now()) return { locked: true, retryAfterSeconds: Math.max(1, Math.ceil((lockedUntil - Date.now()) / 1000)) };
  if (lockedUntil) {
    await getD1().prepare("UPDATE user_security_state SET failed_password_attempts=0,locked_until=NULL,updated_at=?2 WHERE user_id=?1 AND locked_until<=?3")
      .bind(userId, new Date().toISOString(), Date.now()).run();
  }
  return { locked: false, retryAfterSeconds: 0 };
}

export async function recordPasswordFailure(userId: string): Promise<{ locked: boolean; retryAfterSeconds: number }> {
  await ensureSecurityState(userId);
  const now = Date.now();
  const lockedUntil = now + PASSWORD_LOCKOUT_MS;
  const row = await getD1().prepare(`
    UPDATE user_security_state SET
      failed_password_attempts=failed_password_attempts+1,
      last_password_failure_at=?2,
      locked_until=CASE WHEN failed_password_attempts+1>=?3 THEN ?4 ELSE locked_until END,
      updated_at=?2
    WHERE user_id=?1
    RETURNING failed_password_attempts AS failedPasswordAttempts,locked_until AS lockedUntil
  `).bind(userId, new Date(now).toISOString(), MAX_PASSWORD_FAILURES, lockedUntil)
    .first<{ failedPasswordAttempts: number; lockedUntil: number | null }>();
  const locked = Number(row?.lockedUntil ?? 0) > now;
  if (locked) await recordSecurityAudit(userId, "security.password_lockout", { attempts: Number(row?.failedPasswordAttempts ?? MAX_PASSWORD_FAILURES) });
  return { locked, retryAfterSeconds: locked ? Math.ceil(PASSWORD_LOCKOUT_MS / 1000) : 0 };
}

export async function clearPasswordFailures(userId: string): Promise<void> {
  await ensureSecurityState(userId);
  await getD1().prepare(`
    UPDATE user_security_state SET failed_password_attempts=0,locked_until=NULL,last_password_failure_at=NULL,updated_at=?2 WHERE user_id=?1
  `).bind(userId, new Date().toISOString()).run();
}

export async function getAdminPasswordAgeState(userId: string): Promise<{ passwordChangedAt: string | null; expired: boolean; tooYoung: boolean }> {
  await ensureSecurityState(userId);
  const row = await getD1().prepare(`
    SELECT COALESCE(s.password_changed_at,u.created_at) AS passwordChangedAt
    FROM users u LEFT JOIN user_security_state s ON s.user_id=u.id WHERE u.id=?1
  `).bind(userId).first<{ passwordChangedAt: string | null }>();
  const changedAt = row?.passwordChangedAt ?? null;
  const age = changedAt ? Date.now() - Date.parse(changedAt) : Number.POSITIVE_INFINITY;
  return { passwordChangedAt: changedAt, expired: age > ADMIN_PASSWORD_MAX_AGE_MS, tooYoung: age >= 0 && age < ADMIN_PASSWORD_MIN_AGE_MS };
}

export async function assertAdminPasswordChangeAllowed(userId: string, proposedPassword: string, currentHash: string | null): Promise<void> {
  const age = await getAdminPasswordAgeState(userId);
  if (age.tooYoung) throw new Error("Admin password cannot be changed again until 24 hours after the previous password change.");
  if (currentHash && await verifyPassword(proposedPassword, currentHash)) throw new Error("The new password cannot reuse the current password.");
  const history = await getD1().prepare(`
    SELECT password_hash AS passwordHash FROM user_password_history WHERE user_id=?1 ORDER BY created_at DESC,id DESC LIMIT ?2
  `).bind(userId, ADMIN_PASSWORD_HISTORY).all<{ passwordHash: string }>();
  for (const item of history.results ?? []) {
    if (await verifyPassword(proposedPassword, item.passwordHash)) throw new Error(`The new password cannot reuse any of the last ${ADMIN_PASSWORD_HISTORY} passwords.`);
  }
}

export async function replaceAdminCredential(userId: string, previousHash: string | null, newHash: string): Promise<void> {
  const db = getD1();
  await ensureSecurityState(userId);
  const now = new Date().toISOString();
  const priorTime = new Date(Date.now() - 1).toISOString();
  const statements = [
    db.prepare("DELETE FROM sessions WHERE user_id=?1 AND EXISTS(SELECT 1 FROM users WHERE id=?1 AND password_hash IS ?2 AND deleted_at IS NULL)").bind(userId, previousHash),
    db.prepare("UPDATE users SET password_hash=?3 WHERE id=?1 AND password_hash IS ?2 AND deleted_at IS NULL").bind(userId, previousHash, newHash),
  ];
  if (previousHash) statements.push(db.prepare("INSERT INTO user_password_history (id,user_id,password_hash,created_at) VALUES (?1,?2,?3,?4)").bind(randomId("pwh"), userId, previousHash, priorTime));
  statements.push(
    db.prepare("INSERT INTO user_password_history (id,user_id,password_hash,created_at) VALUES (?1,?2,?3,?4)").bind(randomId("pwh"), userId, newHash, now),
    db.prepare(`
      UPDATE user_security_state SET password_changed_at=?2,failed_password_attempts=0,locked_until=NULL,last_password_failure_at=NULL,security_version=security_version+1,updated_at=?2 WHERE user_id=?1
    `).bind(userId, now),
  );
  const results = await db.batch(statements);
  if (results[1].meta.changes !== 1) throw new Error("Credentials changed. Sign in again.");
  await db.prepare(`
    DELETE FROM user_password_history WHERE user_id=?1 AND id NOT IN (
      SELECT id FROM user_password_history WHERE user_id=?1 ORDER BY created_at DESC,id DESC LIMIT ?2
    )
  `).bind(userId, ADMIN_PASSWORD_HISTORY).run();
  await recordSecurityAudit(userId, "security.admin_password_changed");
}

async function ensureSecurityState(userId: string): Promise<void> {
  const now = new Date().toISOString();
  await getD1().prepare(`
    INSERT INTO user_security_state (user_id,password_changed_at,updated_at)
    SELECT id,created_at,?2 FROM users WHERE id=?1
    ON CONFLICT(user_id) DO NOTHING
  `).bind(userId, now).run();
}

async function bumpSecurityVersion(userId: string): Promise<void> {
  await ensureSecurityState(userId);
  await getD1().prepare("UPDATE user_security_state SET security_version=security_version+1,updated_at=?2 WHERE user_id=?1")
    .bind(userId, new Date().toISOString()).run();
}

async function recoveryCodeHash(userId: string, code: string): Promise<string> {
  const pepper = runtimeEnv().SESSION_SECRET;
  if (!pepper || pepper.length < 32) throw new Error("Session security is not configured.");
  return sha256(`${pepper}:admin-recovery:${userId}:${normalizeRecoveryCode(code)}`);
}

function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z2-7]/g, "");
}

function formatRecoveryCode(code: string): string {
  const normalized = normalizeRecoveryCode(code).slice(0, 12);
  return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8, 12)}`;
}

export async function recordSecurityAudit(userId: string, action: string, metadata: Record<string, unknown> = {}): Promise<void> {
  try {
    await getD1().prepare(`
      INSERT INTO audit_events (id,tenant_id,user_id,action,resource_type,resource_id,metadata_json,created_at)
      VALUES (?1,NULL,?2,?3,'authentication',?2,?4,?5)
    `).bind(randomId("aud"), userId, action, JSON.stringify(metadata), new Date().toISOString()).run();
  } catch {
    console.error(JSON.stringify({ event: "security.audit.failure", code: "d1_write_failed" }));
  }
}
