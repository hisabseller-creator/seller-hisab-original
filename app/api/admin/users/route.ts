import { getSessionUser } from "@/server/auth";
import { isAdminUser } from "@/server/admin";
import { getD1 } from "@/server/runtime";
import { isActiveSubscription, summarizeAuthActivity, type AuthActivityRow } from "@/core/admin/user-activity";

export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  name: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
};

type SessionRow = { userId: string; activeSessions: number; latestSessionAt: string | null };
type SubscriptionRow = {
  userId: string;
  provider: string;
  providerSubscriptionId: string;
  plan: string;
  status: string;
  currentPeriodEnd: number | null;
  createdAt: string;
  updatedAt: string;
};
type EntitlementRow = {
  userId: string;
  activeActionReports: number;
  activeActionReportPaidPaise: number;
  lastActionReportAt: string | null;
};

export async function GET(request: Request) {
  const admin = await getSessionUser(request);
  if (!admin) return Response.json({ error: "Admin sign-in required." }, { status: 401 });
  if (!isAdminUser(admin.email, admin.phone)) return Response.json({ error: "Admin access denied." }, { status: 403 });

  const db = getD1();
  const now = Date.now();
  const [usersResult, totalResult, sessionsResult, auditResult, subscriptionsResult, entitlementsResult] = await Promise.all([
    db.prepare(`
      SELECT id,
             name,
             city,
             CASE WHEN email LIKE '%@auth.smg.invalid' THEN NULL ELSE email END AS email,
             phone,
             created_at AS createdAt
      FROM users
      ORDER BY created_at DESC
      LIMIT 500
    `).all<UserRow>(),
    db.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>(),
    db.prepare(`
      SELECT user_id AS userId,
             COUNT(*) AS activeSessions,
             MAX(created_at) AS latestSessionAt
      FROM sessions
      WHERE expires_at > ?1
      GROUP BY user_id
    `).bind(now).all<SessionRow>(),
    db.prepare(`
      SELECT user_id AS userId, action, metadata_json AS metadataJson, created_at AS createdAt
      FROM audit_events
      WHERE resource_type = 'authentication'
        AND action IN ('auth.register_success','auth.login_success','auth.password_reset_success')
      ORDER BY created_at DESC
      LIMIT 5000
    `).all<AuthActivityRow>(),
    db.prepare(`
      SELECT user_id AS userId,
             provider,
             provider_subscription_id AS providerSubscriptionId,
             plan,
             status,
             current_period_end AS currentPeriodEnd,
             created_at AS createdAt,
             updated_at AS updatedAt
      FROM subscriptions
      ORDER BY updated_at DESC
      LIMIT 5000
    `).all<SubscriptionRow>(),
    db.prepare(`
      SELECT e.user_id AS userId,
             COUNT(*) AS activeActionReports,
             COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount_paise ELSE 0 END), 0) AS activeActionReportPaidPaise,
             MAX(e.issued_at) AS lastActionReportAt
      FROM entitlements e
      LEFT JOIN payments p ON p.id = e.payment_id
      WHERE e.user_id IS NOT NULL
        AND e.product = 'action_report'
        AND e.status = 'active'
        AND (e.expires_at IS NULL OR e.expires_at > ?1)
      GROUP BY e.user_id
    `).bind(now).all<EntitlementRow>(),
  ]);

  const activeSessionsByUser = new Map((sessionsResult.results ?? []).map((row) => [row.userId, row]));
  const authByUser = summarizeAuthActivity(auditResult.results ?? []);
  const latestSubscriptionByUser = new Map<string, SubscriptionRow>();
  const activeSubscriptionByUser = new Map<string, SubscriptionRow>();
  for (const row of subscriptionsResult.results ?? []) {
    if (!latestSubscriptionByUser.has(row.userId)) latestSubscriptionByUser.set(row.userId, row);
    const isActive = isActiveSubscription(row.status, row.currentPeriodEnd, now);
    if (isActive && !activeSubscriptionByUser.has(row.userId)) activeSubscriptionByUser.set(row.userId, row);
  }
  const entitlementByUser = new Map((entitlementsResult.results ?? []).map((row) => [row.userId, row]));

  const users = (usersResult.results ?? []).map((user) => {
    const session = activeSessionsByUser.get(user.id);
    const auth = authByUser.get(user.id) ?? { trackedLogins: 0, lastLoginAt: null, lastAuthMethod: null };
    const subscription = activeSubscriptionByUser.get(user.id) ?? latestSubscriptionByUser.get(user.id) ?? null;
    const entitlement = entitlementByUser.get(user.id);
    const subscriptionActive = isActiveSubscription(subscription?.status, subscription?.currentPeriodEnd, now);
    const activeActionReports = Number(entitlement?.activeActionReports ?? 0);

    return {
      ...user,
      activeSessions: Number(session?.activeSessions ?? 0),
      lastLoginAt: auth.lastLoginAt ?? session?.latestSessionAt ?? null,
      trackedLogins: auth.trackedLogins,
      lastAuthMethod: auth.lastAuthMethod,
      subscription: subscription ? {
        provider: subscription.provider,
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        updatedAt: subscription.updatedAt,
        active: subscriptionActive,
      } : null,
      purchases: {
        hasActivePurchase: subscriptionActive || activeActionReports > 0,
        activeActionReports,
        activeActionReportPaidPaise: Number(entitlement?.activeActionReportPaidPaise ?? 0),
        lastActionReportAt: entitlement?.lastActionReportAt ?? null,
      },
    };
  });

  return Response.json({
    users,
    stats: {
      totalRegistered: Number(totalResult?.total ?? users.length),
      activeSessions: (sessionsResult.results ?? []).reduce((sum, row) => sum + Number(row.activeSessions ?? 0), 0),
      usersWithTrackedLogin: authByUser.size,
      usersWithActivePurchase: new Set([
        ...activeSubscriptionByUser.keys(),
        ...entitlementByUser.keys(),
      ]).size,
    },
    visibleUsers: users.length,
    trackingNote: "Detailed login tracking starts from the authentication activity release. Older active sessions may appear without a historical login count. The admin list shows the 500 newest registered accounts.",
    privacy: "Passwords, OTPs, access tokens, session tokens and payment secrets are never returned by this endpoint.",
  }, { headers: { "cache-control": "no-store" } });
}
