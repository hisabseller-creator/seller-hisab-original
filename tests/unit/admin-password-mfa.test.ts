import { beforeEach, expect, it, vi } from "vitest";
import { testDatabase } from "../helpers/d1";

const state = vi.hoisted(() => ({
  db: null as D1Database | null,
  getSessionUser: vi.fn(),
  createSession: vi.fn(),
  hasAdminStepUp: vi.fn(),
  getAdminMfaStatus: vi.fn(),
  verifyAdminSecondFactor: vi.fn(),
  assertAdminPasswordChangeAllowed: vi.fn(),
  replaceAdminCredential: vi.fn(),
}));

vi.mock("@/server/runtime", () => ({
  getD1: () => state.db,
  appEnvironment: () => "production",
  runtimeEnv: () => ({ ADMIN_EMAILS: "admin@example.invalid", ADMIN_PHONES: "", APP_ENV: "production" }),
}));
vi.mock("@/server/auth", () => ({
  getSessionUser: state.getSessionUser,
  createSession: state.createSession,
}));
vi.mock("@/server/admin-step-up", () => ({ hasAdminStepUp: state.hasAdminStepUp }));
vi.mock("@/server/admin-security", () => ({
  getAdminMfaStatus: state.getAdminMfaStatus,
  verifyAdminSecondFactor: state.verifyAdminSecondFactor,
  assertAdminPasswordChangeAllowed: state.assertAdminPasswordChangeAllowed,
  replaceAdminCredential: state.replaceAdminCredential,
}));
vi.mock("@/server/rate-limit", () => ({
  enforceIpRateLimit: vi.fn(),
  enforceRateLimit: vi.fn(),
  RateLimitError: class extends Error { resetAt = Date.now() + 60_000; },
}));

import { hashPassword } from "@/server/password";
import { POST } from "@/app/api/admin/change-password/route";

beforeEach(async () => {
  state.db = testDatabase().d1;
  state.getSessionUser.mockReset().mockResolvedValue({ id: "admin-user", email: "admin@example.invalid", phone: null, createdAt: "2026-01-01" });
  state.createSession.mockReset().mockResolvedValue({ cookie: "smg_session=fresh" });
  state.hasAdminStepUp.mockReset().mockResolvedValue(false);
  state.getAdminMfaStatus.mockReset().mockResolvedValue({ enabled: true, passwordExpired: false });
  state.verifyAdminSecondFactor.mockReset().mockResolvedValue(null);
  state.assertAdminPasswordChangeAllowed.mockReset().mockResolvedValue(undefined);
  state.replaceAdminCredential.mockReset().mockResolvedValue(undefined);
  const currentHash = await hashPassword("CurrentAdmin123!");
  await state.db.prepare("INSERT INTO users(id,email,password_hash,created_at) VALUES(?1,?2,?3,?4)")
    .bind("admin-user", "admin@example.invalid", currentHash, "2026-01-01").run();
});

function request(code?: string) {
  return new Request("https://sellerhisab.com/api/admin/change-password", {
    method: "POST",
    headers: { origin: "https://sellerhisab.com", "content-type": "application/json" },
    body: JSON.stringify({ currentPassword: "CurrentAdmin123!", newPassword: "ReplacementAdmin456!", code }),
  });
}

it("requires a second factor when MFA is enabled and no active step-up proof exists", async () => {
  const response = await POST(request());
  expect(response.status).toBe(401);
  expect(state.replaceAdminCredential).not.toHaveBeenCalled();
});

it("accepts a valid second factor when an active step-up proof is unavailable", async () => {
  state.verifyAdminSecondFactor.mockResolvedValue("totp");
  const response = await POST(request("123456"));
  expect(response.status).toBe(200);
  expect(state.verifyAdminSecondFactor).toHaveBeenCalledWith("admin-user", "123456");
  expect(state.replaceAdminCredential).toHaveBeenCalledTimes(1);
});

it("allows a password change through an already-valid privileged step-up without consuming another code", async () => {
  state.hasAdminStepUp.mockResolvedValue(true);
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(state.verifyAdminSecondFactor).not.toHaveBeenCalled();
  expect(state.replaceAdminCredential).toHaveBeenCalledTimes(1);
});
