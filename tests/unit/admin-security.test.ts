import { beforeEach, describe, expect, it, vi } from "vitest";
import { testDatabase } from "../helpers/d1";

const state = vi.hoisted(() => ({ db: null as D1Database | null }));
vi.mock("@/server/runtime", () => ({
  getD1: () => state.db,
  runtimeEnv: () => ({
    SESSION_SECRET: "session-secret-for-tests-0123456789abcdef",
    CONNECTOR_ENCRYPTION_KEY: "connector-key-for-tests-0123456789abcdef",
  }),
}));

import { hashPassword } from "@/server/password";
import { totpCodeForStep } from "@/server/totp";
import {
  assertAdminPasswordChangeAllowed,
  clearPasswordFailures,
  confirmAdminMfaEnrollment,
  getAdminMfaStatus,
  getAdminPasswordAgeState,
  getLoginLockState,
  recordPasswordFailure,
  replaceAdminCredential,
  startAdminMfaEnrollment,
  verifyAdminSecondFactor,
} from "@/server/admin-security";

describe("admin security controls", () => {
  beforeEach(() => { state.db = testDatabase().d1; });

  async function seedUser(id = "admin-user") {
    const passwordHash = await hashPassword("CurrentAdmin123!");
    const createdAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await state.db!.prepare("INSERT INTO users(id,email,phone,password_hash,created_at) VALUES(?1,?2,?3,?4,?5)")
      .bind(id, "admin@example.invalid", "919876543210", passwordHash, createdAt).run();
    return { id, passwordHash, createdAt };
  }

  it("encrypts the TOTP secret, consumes TOTP steps, and makes recovery codes single-use", async () => {
    const user = await seedUser();
    const enrollment = await startAdminMfaEnrollment(user.id, "admin@example.invalid");
    const stored = await state.db!.prepare("SELECT pending_secret_ciphertext AS ciphertext FROM admin_mfa_settings WHERE user_id=?1")
      .bind(user.id).first<{ ciphertext: string }>();
    expect(stored?.ciphertext).toBeTruthy();
    expect(stored?.ciphertext).not.toContain(enrollment.secret);

    const step = Math.floor(Date.now() / 30_000);
    const confirmationCode = await totpCodeForStep(enrollment.secret, step);
    const recoveryCodes = await confirmAdminMfaEnrollment(user.id, confirmationCode);
    expect(recoveryCodes).toHaveLength(10);
    expect((await getAdminMfaStatus(user.id)).enabled).toBe(true);

    const nextCode = await totpCodeForStep(enrollment.secret, step + 1);
    expect(await verifyAdminSecondFactor(user.id, nextCode)).toBe("totp");
    expect(await verifyAdminSecondFactor(user.id, nextCode)).toBeNull();

    expect(await verifyAdminSecondFactor(user.id, recoveryCodes[0])).toBe("recovery");
    expect(await verifyAdminSecondFactor(user.id, recoveryCodes[0])).toBeNull();
    const recoveryRow = await state.db!.prepare("SELECT code_hash AS codeHash FROM admin_mfa_recovery_codes WHERE user_id=?1 LIMIT 1")
      .bind(user.id).first<{ codeHash: string }>();
    expect(recoveryRow?.codeHash).toBeTruthy();
    expect(recoveryRow?.codeHash).not.toContain(recoveryCodes[0].replaceAll("-", ""));
  });

  it("locks after ten consecutive password failures and resets after success", async () => {
    const user = await seedUser();
    for (let attempt = 1; attempt < 10; attempt += 1) {
      expect((await recordPasswordFailure(user.id)).locked).toBe(false);
    }
    expect((await recordPasswordFailure(user.id)).locked).toBe(true);
    expect((await getLoginLockState(user.id)).locked).toBe(true);
    await clearPasswordFailures(user.id);
    expect((await getLoginLockState(user.id)).locked).toBe(false);
  });

  it("enforces one-day minimum age, 365-day maximum age and last-ten prior password history", async () => {
    const user = await seedUser();
    const nextPassword = "NextAdminPassword456!";
    await assertAdminPasswordChangeAllowed(user.id, nextPassword, user.passwordHash);
    const nextHash = await hashPassword(nextPassword);
    await replaceAdminCredential(user.id, user.passwordHash, nextHash);

    const storedHistory = await state.db!.prepare("SELECT password_hash AS passwordHash FROM user_password_history WHERE user_id=?1")
      .bind(user.id).all<{ passwordHash: string }>();
    expect(storedHistory.results).toHaveLength(1);
    expect(storedHistory.results[0]?.passwordHash).toBe(user.passwordHash);

    await expect(assertAdminPasswordChangeAllowed(user.id, "AnotherAdmin789!", nextHash)).rejects.toThrow(/24 hours/i);

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await state.db!.prepare("UPDATE user_security_state SET password_changed_at=?2 WHERE user_id=?1").bind(user.id, twoDaysAgo).run();
    await expect(assertAdminPasswordChangeAllowed(user.id, "CurrentAdmin123!", nextHash)).rejects.toThrow(/last 10 passwords/i);
    await expect(assertAdminPasswordChangeAllowed(user.id, nextPassword, nextHash)).rejects.toThrow(/current password/i);

    const tooOld = new Date(Date.now() - 366 * 24 * 60 * 60 * 1000).toISOString();
    await state.db!.prepare("UPDATE user_security_state SET password_changed_at=?2 WHERE user_id=?1").bind(user.id, tooOld).run();
    expect((await getAdminPasswordAgeState(user.id)).expired).toBe(true);
  });
});
