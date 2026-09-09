export type AuthActivityRow = {
  userId: string | null;
  action: string;
  metadataJson: string | null;
  createdAt: string;
};

export type AuthActivitySummary = {
  trackedLogins: number;
  lastLoginAt: string | null;
  lastAuthMethod: string | null;
};

const AUTH_ACTIONS = new Set(["auth.register_success", "auth.login_success", "auth.password_reset_success"]);

export function summarizeAuthActivity(rows: AuthActivityRow[]): Map<string, AuthActivitySummary> {
  const summaries = new Map<string, AuthActivitySummary>();
  for (const row of rows) {
    if (!row.userId || !AUTH_ACTIONS.has(row.action)) continue;
    const current = summaries.get(row.userId) ?? { trackedLogins: 0, lastLoginAt: null, lastAuthMethod: null };
    current.trackedLogins += 1;
    if (!current.lastLoginAt) {
      current.lastLoginAt = row.createdAt;
      current.lastAuthMethod = readAuthMethod(row.metadataJson);
    }
    summaries.set(row.userId, current);
  }
  return summaries;
}

export function isActiveSubscription(status: string | null | undefined, currentPeriodEnd: number | null | undefined, now: number): boolean {
  return status === "active" && (!currentPeriodEnd || currentPeriodEnd > now);
}

function readAuthMethod(metadataJson: string | null): string | null {
  if (!metadataJson) return null;
  try {
    const parsed = JSON.parse(metadataJson) as { method?: unknown };
    return typeof parsed.method === "string" ? parsed.method : null;
  } catch {
    return null;
  }
}
