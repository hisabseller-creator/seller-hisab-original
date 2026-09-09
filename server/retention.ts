import { getD1 } from "./runtime";

const MAX_ANALYSES_PER_USER = 100;
const MAX_ALERTS_PER_USER = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Keep derived account history bounded so a long-lived account cannot grow D1
 * storage forever. Raw marketplace report bytes are never stored by this path.
 */
export async function pruneUserHistory(userId: string): Promise<void> {
  const db = getD1();

  await db.prepare(
    `DELETE FROM analyses
     WHERE user_id = ?1
       AND id NOT IN (
         SELECT id FROM analyses
         WHERE user_id = ?1
         ORDER BY created_at DESC
         LIMIT ?2
       )`,
  ).bind(userId, MAX_ANALYSES_PER_USER).run();

  await db.prepare(
    `DELETE FROM alerts
     WHERE user_id = ?1
       AND id NOT IN (
         SELECT id FROM alerts
         WHERE user_id = ?1
         ORDER BY created_at DESC
         LIMIT ?2
       )`,
  ).bind(userId, MAX_ALERTS_PER_USER).run();
}

/** Expired authentication sessions are no longer usable and are safe to remove. */
export async function maybePruneExpiredSessions(): Promise<void> {
  try {
    await getD1().prepare("DELETE FROM sessions WHERE expires_at <= ?1").bind(Date.now()).run();
  } catch {
    // Cleanup is best-effort and must never block authentication.
  }
}

/**
 * Bounded retention for ephemeral operational/security records only.
 * Financial, entitlement, billing-audit and completed-import evidence are not
 * deleted by this job because their statutory/dispute retention is a business
 * policy decision. Account deletion has its own explicit lifecycle handler.
 */
export async function pruneOperationalRetention(nowMs = Date.now()): Promise<void> {
  const db = getD1();
  const sevenDaysAgoIso = new Date(nowMs - 7 * DAY_MS).toISOString();
  const ninetyDaysAgoIso = new Date(nowMs - 90 * DAY_MS).toISOString();
  const now = nowMs;

  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?1").bind(now),
    db.prepare("DELETE FROM connector_oauth_states WHERE expires_at <= ?1").bind(now),
    db.prepare("DELETE FROM otp_challenges WHERE expires_at <= ?1 AND created_at < ?2").bind(now, sevenDaysAgoIso),
    db.prepare("DELETE FROM rate_limits WHERE reset_at <= ?1").bind(now),
    db.prepare("DELETE FROM connector_sync_jobs WHERE status = 'completed' AND completed_at IS NOT NULL AND completed_at < ?1 AND NOT EXISTS(SELECT 1 FROM commerce_ledger_entries le WHERE json_valid(le.source_reference_json) AND json_extract(le.source_reference_json,'$.coverageJobId')=connector_sync_jobs.id)").bind(ninetyDaysAgoIso),
  ]);
}
