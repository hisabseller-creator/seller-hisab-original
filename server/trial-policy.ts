export const DEFAULT_TRIAL_DAYS = 3;
export const MIN_TRIAL_DAYS = 1;
export const MAX_TRIAL_DAYS = 30;

export function normalizeTrialDays(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_TRIAL_DAYS;
  return Math.max(MIN_TRIAL_DAYS, Math.min(MAX_TRIAL_DAYS, Math.trunc(parsed)));
}

export function trialIsActive(status: string, trialEndsAt: number, nowMs = Date.now()): boolean {
  return status === "active" && Number.isFinite(trialEndsAt) && trialEndsAt > nowMs;
}
