import { getD1, runtimeEnv } from "./runtime";
import { randomId, signToken, verifyToken } from "./crypto";

export type EntitlementPayload = {
  analysisId: string;
  product: "action_report";
  entitlementId: string;
  iat: number;
  exp: number;
};

type EntitlementOwnerRow = {
  id: string;
  userId: string | null;
};

export async function issueEntitlement(analysisId: string, paymentId: string, userId?: string): Promise<string> {
  const secret = entitlementSecret();
  const db = getD1();
  const now = new Date().toISOString();
  const candidateId = randomId("ent");
  // One analysis/product can have exactly one entitlement. The conditional
  // upsert makes browser verification and webhook delivery safe in either order
  // without allowing a different account to steal an established entitlement.
  await db.prepare(`
    INSERT INTO entitlements (id, analysis_id, user_id, payment_id, product, status, issued_at)
    VALUES (?1, ?2, ?3, ?4, 'action_report', 'active', ?5)
    ON CONFLICT(analysis_id, product) DO UPDATE SET
      user_id = COALESCE(entitlements.user_id, excluded.user_id),
      payment_id = excluded.payment_id,
      status = 'active',
      issued_at = excluded.issued_at
    WHERE entitlements.user_id IS NULL
       OR excluded.user_id IS NULL
       OR entitlements.user_id = excluded.user_id
  `).bind(candidateId, analysisId, userId ?? null, paymentId, now).run();

  const existing = await db.prepare(
    "SELECT id, user_id AS userId FROM entitlements WHERE analysis_id = ?1 AND product = 'action_report'",
  ).bind(analysisId).first<EntitlementOwnerRow>();
  if (!existing) throw new Error("Paid entitlement could not be created.");
  if (existing.userId && userId && existing.userId !== userId) {
    throw new Error("This paid report is already linked to another account.");
  }
  return signEntitlementToken({ analysisId, entitlementId: existing.id }, secret);
}

export async function restoreEntitlement(analysisId: string, userId: string): Promise<string | null> {
  const row = await getD1().prepare(
    `SELECT id
     FROM entitlements
     WHERE analysis_id = ?1 AND user_id = ?2 AND product = 'action_report' AND status = 'active'`,
  ).bind(analysisId, userId).first<{ id: string }>();
  if (!row) return null;
  return signEntitlementToken({ analysisId, entitlementId: row.id }, entitlementSecret());
}

export async function linkEntitlementToUser(analysisId: string, userId: string): Promise<boolean> {
  const db = getD1();
  const row = await db.prepare(
    `SELECT e.id,
            e.user_id AS entitlementUserId,
            p.user_id AS paymentUserId
     FROM entitlements e
     LEFT JOIN payments p ON p.id = e.payment_id
     WHERE e.analysis_id = ?1 AND e.product = 'action_report' AND e.status = 'active'`,
  ).bind(analysisId).first<{ id: string; entitlementUserId: string | null; paymentUserId: string | null }>();

  if (!row) return false;
  if (row.entitlementUserId && row.entitlementUserId !== userId) return false;
  if (row.paymentUserId && row.paymentUserId !== userId) return false;

  await db.prepare(
    "UPDATE entitlements SET user_id = COALESCE(user_id, ?1) WHERE id = ?2",
  ).bind(userId, row.id).run();
  await db.prepare(
    "UPDATE payments SET user_id = COALESCE(user_id, ?1) WHERE analysis_id = ?2 AND status = 'paid'",
  ).bind(userId, analysisId).run();
  return true;
}

export async function validateEntitlement(token: string, analysisId: string): Promise<boolean> {
  const secret = runtimeEnv().ENTITLEMENT_SECRET;
  if (!secret) return false;
  const payload = await verifyToken<EntitlementPayload>(token, secret);
  if (!payload || payload.analysisId !== analysisId || payload.product !== "action_report" || !payload.entitlementId) return false;
  const row = await getD1().prepare(
    `SELECT status
     FROM entitlements
     WHERE id = ?1 AND analysis_id = ?2 AND product = 'action_report'`,
  ).bind(payload.entitlementId, analysisId).first<{ status: string }>();
  return row?.status === "active";
}

function entitlementSecret() {
  const secret = runtimeEnv().ENTITLEMENT_SECRET;
  if (!secret || secret.length < 32) throw new Error("Entitlement signing is not configured.");
  return secret;
}

function signEntitlementToken(
  input: { analysisId: string; entitlementId: string },
  secret: string,
): Promise<string> {
  return signToken({
    analysisId: input.analysisId,
    product: "action_report",
    entitlementId: input.entitlementId,
    iat: Date.now(),
    exp: Date.now() + 366 * 24 * 60 * 60 * 1000,
  } satisfies EntitlementPayload, secret);
}
