import { parseFinancialDate } from "@/core/dates";
import { buildAdsEconomicsSummary, type AdsCampaignEconomics, type AdsEconomicsRow, type AdsEconomicsSummary } from "@/core/ads/economics";
import { assertPaise } from "@/core/money";
import type { SessionUser } from "./auth";
import { randomId, sha256 } from "./crypto";
import { ensureTenantForUser } from "./connectors/store";
import { getD1 } from "./runtime";

const SUPPORTED_CHANNELS = new Set(["amazon-in", "flipkart", "meesho", "shopify"]);

export type NormalizedAdPerformanceInput = {
  rowKey: string;
  reportDate: string;
  campaignName: string;
  campaignId?: string;
  adGroupName?: string;
  sku?: string;
  spendPaise: number;
  attributedSalesPaise?: number;
  attributedOrders?: number;
  clicks?: number;
  impressions?: number;
  currency: string;
  sourceRow: number;
};

export type AdsWorkspaceSummary = AdsEconomicsSummary & {
  latestImport?: { fileName: string | null; channelId: string | null; coverageStart: string | null; coverageEnd: string | null; createdAt: string };
};

type StoredAdRow = AdsEconomicsRow & { sourceImportId: string };

function safeText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
}

function safeIso(value: unknown): string | undefined {
  return parseFinancialDate(value, { numericDateOrder: "dmy", assumeUtcForTimezoneLessIso: true });
}

function safeCount(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 1_000_000_000 ? number : undefined;
}

function validateRow(input: NormalizedAdPerformanceInput): NormalizedAdPerformanceInput | null {
  const rowKey = safeText(input.rowKey, 240);
  const reportDate = safeIso(input.reportDate);
  const campaignName = safeText(input.campaignName, 160);
  if (!rowKey || !reportDate || !campaignName) return null;
  if (!Number.isSafeInteger(input.spendPaise) || input.spendPaise < 0) return null;
  if (input.attributedSalesPaise !== undefined && (!Number.isSafeInteger(input.attributedSalesPaise) || input.attributedSalesPaise < 0)) return null;
  if (safeText(input.currency, 8)?.toUpperCase() !== "INR") return null;
  const sourceRow = Number(input.sourceRow);
  if (!Number.isInteger(sourceRow) || sourceRow < 1 || sourceRow > 2_000_000) return null;
  return {
    rowKey,
    reportDate,
    campaignName,
    campaignId: safeText(input.campaignId, 120),
    adGroupName: safeText(input.adGroupName, 160),
    sku: safeText(input.sku, 120),
    spendPaise: input.spendPaise,
    attributedSalesPaise: input.attributedSalesPaise,
    attributedOrders: safeCount(input.attributedOrders),
    clicks: safeCount(input.clicks),
    impressions: safeCount(input.impressions),
    currency: "INR",
    sourceRow,
  };
}

async function loadRows(tenantId: string): Promise<StoredAdRow[]> {
  const db = getD1();
  const output: StoredAdRow[] = [];
  const pageSize = 5_000;
  const hardLimit = 100_000;
  for (let offset = 0; offset < hardLimit; offset += pageSize) {
    const result = await db.prepare(`
      SELECT apr.id, apr.source_import_id AS sourceImportId, apr.channel_id AS channelId, apr.report_date AS reportDate,
             apr.campaign_name AS campaignName, apr.campaign_id AS campaignId, apr.ad_group_name AS adGroupName, apr.sku,
             apr.spend_paise AS spendPaise, apr.attributed_sales_paise AS attributedSalesPaise,
             apr.attributed_orders AS attributedOrders, apr.clicks, apr.impressions
      FROM ad_performance_rows apr
      JOIN data_imports di ON di.id = apr.source_import_id AND di.tenant_id = apr.tenant_id
      WHERE apr.tenant_id = ?1 AND apr.is_active = 1 AND di.status = 'completed'
      ORDER BY apr.report_date DESC, apr.created_at DESC, apr.id DESC
      LIMIT ?2 OFFSET ?3
    `).bind(tenantId, pageSize, offset).all<{
      id: string; sourceImportId: string; channelId: string; reportDate: string; campaignName: string; campaignId: string | null;
      adGroupName: string | null; sku: string | null; spendPaise: number; attributedSalesPaise: number | null;
      attributedOrders: number | null; clicks: number | null; impressions: number | null;
    }>();
    const page = result.results ?? [];
    output.push(...page.map((row) => ({
      id: row.id,
      sourceImportId: row.sourceImportId,
      channelId: row.channelId,
      reportDate: row.reportDate,
      campaignName: row.campaignName,
      campaignId: row.campaignId ?? undefined,
      adGroupName: row.adGroupName ?? undefined,
      sku: row.sku ?? undefined,
      spendPaise: assertPaise(row.spendPaise),
      attributedSalesPaise: row.attributedSalesPaise === null ? undefined : assertPaise(row.attributedSalesPaise),
      attributedOrders: row.attributedOrders ?? undefined,
      clicks: row.clicks ?? undefined,
      impressions: row.impressions ?? undefined,
    })));
    if (page.length < pageSize) return output;
  }
  throw new Error("Ad history exceeds the current 100,000-row safety window. Narrow the reporting period before calculating Ads economics.");
}

async function loadPreferences(tenantId: string): Promise<{ preAdMarginBps?: number; returnLossBps?: number }> {
  const row = await getD1().prepare(`
    SELECT pre_ad_margin_bps AS preAdMarginBps, return_loss_bps AS returnLossBps
    FROM ad_preferences WHERE tenant_id = ?1
  `).bind(tenantId).first<{ preAdMarginBps: number | null; returnLossBps: number | null }>();
  return {
    preAdMarginBps: row?.preAdMarginBps ?? undefined,
    returnLossBps: row?.returnLossBps ?? undefined,
  };
}

async function latestImport(tenantId: string): Promise<AdsWorkspaceSummary["latestImport"]> {
  const row = await getD1().prepare(`
    SELECT original_file_name AS fileName, schema_fingerprint AS schemaFingerprint, coverage_start AS coverageStart, coverage_end AS coverageEnd, created_at AS createdAt
    FROM data_imports
    WHERE tenant_id = ?1 AND connector_id = 'ads-file-v1' AND status = 'completed'
    ORDER BY created_at DESC LIMIT 1
  `).bind(tenantId).first<{ fileName: string | null; schemaFingerprint: string | null; coverageStart: string | null; coverageEnd: string | null; createdAt: string }>();
  if (!row) return undefined;
  let channelId: string | null = null;
  try {
    const parsed = JSON.parse(row.schemaFingerprint ?? "{}") as { channelId?: unknown };
    channelId = typeof parsed.channelId === "string" ? parsed.channelId : null;
  } catch { /* Older malformed metadata stays non-fatal. */ }
  return { fileName: row.fileName, channelId, coverageStart: row.coverageStart, coverageEnd: row.coverageEnd, createdAt: row.createdAt };
}

async function writeAdsAudit(input: { tenantId: string; userId: string; action: string; resourceId?: string; metadata?: Record<string, unknown> }) {
  await getD1().prepare(`
    INSERT INTO audit_events (id, tenant_id, user_id, action, resource_type, resource_id, metadata_json, created_at)
    VALUES (?1, ?2, ?3, ?4, 'ads', ?5, ?6, ?7)
  `).bind(randomId("aud"), input.tenantId, input.userId, input.action, input.resourceId ?? null, input.metadata ? JSON.stringify(input.metadata) : null, new Date().toISOString()).run();
}

function actionType(campaign: AdsCampaignEconomics): string | undefined {
  if (campaign.action === "Review or reduce spend") return "ads.review-loss-campaign";
  if (campaign.action === "Watch margin") return "ads.watch-margin";
  if (campaign.action === "Review scale opportunity") return "ads.review-scale-opportunity";
  if (campaign.action === "Add attributed sales") return "ads.add-attributed-sales";
  if (campaign.action === "Set margin baseline") return "ads.set-margin-baseline";
  return undefined;
}

async function syncAdsActionsAndAlert(input: { tenantId: string; userId: string; summary: AdsWorkspaceSummary }) {
  const db = getD1();
  await db.batch([
    db.prepare("DELETE FROM action_recommendations WHERE tenant_id = ?1 AND action_type LIKE 'ads.%' AND status = 'open'").bind(input.tenantId),
    db.prepare("DELETE FROM alerts WHERE user_id = ?1 AND type = 'ads-economics' AND status = 'open'").bind(input.userId),
  ]);
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  for (const campaign of input.summary.campaigns.slice(0, 100)) {
    const type = actionType(campaign);
    if (!type) continue;
    const id = `act_${(await sha256(`${input.tenantId}:${type}:${campaign.key}`)).slice(0, 28)}`;
    statements.push(db.prepare(`
      INSERT INTO action_recommendations
        (id, tenant_id, target_type, target_id, action_type, expected_impact_paise, confidence_bps, evidence_json, status, created_at, updated_at)
      VALUES (?1, ?2, 'campaign', ?3, ?4, ?5, ?6, ?7, 'open', ?8, ?8)
      ON CONFLICT(id) DO UPDATE SET
        expected_impact_paise = excluded.expected_impact_paise,
        confidence_bps = excluded.confidence_bps,
        evidence_json = excluded.evidence_json,
        status = CASE WHEN action_recommendations.status IN ('done','dismissed') THEN action_recommendations.status ELSE 'open' END,
        updated_at = excluded.updated_at
    `).bind(
      id,
      input.tenantId,
      campaign.key,
      type,
      campaign.overshootPaise ?? 0,
      campaign.salesCoverageComplete && input.summary.preAdMarginBps ? 9000 : 6500,
      JSON.stringify({
        channelId: campaign.channelId,
        campaignName: campaign.campaignName,
        action: campaign.action,
        reason: campaign.reason,
        spendPaise: campaign.spendPaise,
        attributedSalesPaise: campaign.attributedSalesPaise,
        actualAcosBps: campaign.actualAcosBps,
        maxAcosBps: input.summary.maxAcosBps,
      }),
      now,
    ));
  }
  for (let index = 0; index < statements.length; index += 50) await db.batch(statements.slice(index, index + 50));

  if (input.summary.spendAtRiskPaise > 0) {
    const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(input.summary.spendAtRiskPaise / 100);
    await db.prepare(`
      INSERT INTO alerts (id, user_id, type, message, status, created_at)
      VALUES (?1, ?2, 'ads-economics', ?3, 'open', ?4)
    `).bind(randomId("alt"), input.userId, `${amount} ad spend exceeds the modeled sustainable spend under your current margin assumptions. Review the flagged campaigns.`, now).run();
  }
}

export async function getAdsSummary(user: SessionUser): Promise<AdsWorkspaceSummary> {
  const tenantId = await ensureTenantForUser(user);
  const [rows, preferences, latest] = await Promise.all([loadRows(tenantId), loadPreferences(tenantId), latestImport(tenantId)]);
  return { ...buildAdsEconomicsSummary(rows, preferences), latestImport: latest };
}

export async function importAdPerformance(input: {
  user: SessionUser;
  channelId: string;
  fileName: string;
  sourceFingerprint: string;
  coverageStart?: string;
  coverageEnd?: string;
  rows: NormalizedAdPerformanceInput[];
}): Promise<{ importedCount: number; duplicate: boolean; summary: AdsWorkspaceSummary }> {
  if (!SUPPORTED_CHANNELS.has(input.channelId)) throw new Error("Choose a supported F8 channel before importing the ad report.");
  const tenantId = await ensureTenantForUser(input.user);
  const rawFingerprint = input.sourceFingerprint.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(rawFingerprint)) throw new Error("Ad report fingerprint is invalid.");
  const fileName = safeText(input.fileName, 160);
  if (!fileName) throw new Error("Ad report file name is required.");
  if (!Array.isArray(input.rows) || input.rows.length < 1 || input.rows.length > 10_000) throw new Error("Ad import must contain 1 to 10,000 normalized rows.");
  const rows = input.rows.map(validateRow).filter((row): row is NormalizedAdPerformanceInput => Boolean(row));
  if (!rows.length) throw new Error("No valid normalized ad-performance rows were supplied.");

  const sourceFingerprint = await sha256(`ads:${input.channelId}:${rawFingerprint}`);
  const db = getD1();
  const existing = await db.prepare("SELECT id, status FROM data_imports WHERE tenant_id = ?1 AND source_fingerprint = ?2 LIMIT 1")
    .bind(tenantId, sourceFingerprint).first<{ id: string; status: string }>();
  if (existing?.id && existing.status === "completed") return { importedCount: 0, duplicate: true, summary: await getAdsSummary(input.user) };

  const importId = existing?.id ?? `imp_${(await sha256(`${tenantId}:ads:${input.channelId}:${rawFingerprint}`)).slice(0, 28)}`;
  const now = new Date().toISOString();
  const dates = rows.map((row) => row.reportDate).sort();
  const coverageStart = safeIso(input.coverageStart) ?? dates[0];
  const coverageEnd = safeIso(input.coverageEnd) ?? dates.at(-1);
  if (!coverageStart || !coverageEnd || coverageStart > coverageEnd) throw new Error("Ad report coverage is invalid.");

  const overlapRows = await db.prepare(`
    SELECT id, coverage_start AS coverageStart, coverage_end AS coverageEnd
    FROM data_imports
    WHERE tenant_id = ?1 AND connector_id = 'ads-file-v1' AND status = 'completed' AND id != ?2
      AND json_extract(COALESCE(schema_fingerprint, '{}'), '$.channelId') = ?3
      AND coverage_start IS NOT NULL AND coverage_end IS NOT NULL
      AND coverage_start <= ?5 AND coverage_end >= ?4
    ORDER BY created_at DESC
  `).bind(tenantId, importId, input.channelId, coverageStart, coverageEnd).all<{ id: string; coverageStart: string; coverageEnd: string }>();
  const overlaps = overlapRows.results ?? [];
  const partialOverlap = overlaps.find((item) => item.coverageStart !== coverageStart || item.coverageEnd !== coverageEnd);
  if (partialOverlap) {
    throw new Error(`This ad report overlaps an existing ${partialOverlap.coverageStart} to ${partialOverlap.coverageEnd} report. Import the exact full replacement period or a non-overlapping period so spend is not double-counted.`);
  }

  if (existing?.id) {
    await db.prepare("DELETE FROM ad_performance_rows WHERE source_import_id = ?1 AND tenant_id = ?2").bind(importId, tenantId).run();
    await db.prepare(`
      UPDATE data_imports SET status = 'in_progress', original_file_name = ?3, schema_fingerprint = ?4,
        coverage_start = ?5, coverage_end = ?6, failed_at = NULL, completed_at = NULL, last_error_code = NULL
      WHERE id = ?1 AND tenant_id = ?2
    `).bind(importId, tenantId, fileName, JSON.stringify({ channelId: input.channelId }), coverageStart, coverageEnd).run();
  } else {
    await db.prepare(`
      INSERT INTO data_imports
        (id, tenant_id, user_id, source_kind, connector_id, parser_version, original_file_name, source_fingerprint, schema_fingerprint, coverage_start, coverage_end, status, issue_count, created_at)
      VALUES (?1, ?2, ?3, 'file', 'ads-file-v1', 'ads-parser-v2', ?4, ?5, ?6, ?7, ?8, 'in_progress', 0, ?9)
    `).bind(importId, tenantId, input.user.id, fileName, sourceFingerprint, JSON.stringify({ channelId: input.channelId }), coverageStart, coverageEnd, now).run();
  }

  try {
    // An exact-period replacement is authoritative for that channel/window. Old
    // rows stay in D1 for auditability but are removed from active calculations.
    for (const prior of overlaps) {
      await db.prepare("UPDATE ad_performance_rows SET is_active = 0, superseded_at = ?3 WHERE source_import_id = ?1 AND tenant_id = ?2 AND is_active = 1")
        .bind(prior.id, tenantId, now).run();
      await db.prepare("UPDATE data_imports SET superseded_by_import_id = ?2 WHERE id = ?1 AND tenant_id = ?3")
        .bind(prior.id, importId, tenantId).run();
    }

    let importedCount = 0;
    for (const row of rows) {
      const logicalKey = await sha256(JSON.stringify([
        input.channelId,
        row.reportDate,
        row.campaignId?.trim().toLowerCase() ?? row.campaignName.trim().toLowerCase(),
        row.adGroupName?.trim().toLowerCase() ?? "",
        row.sku?.trim().toLowerCase() ?? "",
      ]));
      await db.prepare(`
        UPDATE ad_performance_rows SET is_active = 0, superseded_at = ?3
        WHERE tenant_id = ?1 AND logical_key = ?2 AND is_active = 1 AND source_import_id != ?4
      `).bind(tenantId, logicalKey, now, importId).run();
      const id = `adr_${(await sha256(`${tenantId}:${importId}:${row.rowKey}`)).slice(0, 28)}`;
      await db.prepare(`
        INSERT INTO ad_performance_rows
          (id, tenant_id, user_id, source_import_id, row_key, report_date, channel_id, campaign_name, campaign_id, ad_group_name, sku,
           spend_paise, attributed_sales_paise, attributed_orders, clicks, impressions, currency, source_row, created_at, logical_key, is_active)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, 'INR', ?17, ?18, ?19, 1)
      `).bind(
        id, tenantId, input.user.id, importId, row.rowKey, row.reportDate, input.channelId, row.campaignName,
        row.campaignId ?? null, row.adGroupName ?? null, row.sku ?? null, row.spendPaise, row.attributedSalesPaise ?? null,
        row.attributedOrders ?? null, row.clicks ?? null, row.impressions ?? null, row.sourceRow, now, logicalKey,
      ).run();
      importedCount += 1;
    }
    await db.prepare("UPDATE data_imports SET status = 'completed', completed_at = ?2 WHERE id = ?1 AND tenant_id = ?3")
      .bind(importId, new Date().toISOString(), tenantId).run();
    await writeAdsAudit({ tenantId, userId: input.user.id, action: "ads.import.completed", resourceId: importId, metadata: { fileName, channelId: input.channelId, normalizedRows: rows.length, importedCount, coverageStart, coverageEnd, replacementImports: overlaps.map((item) => item.id) } });
    const summary = await getAdsSummary(input.user);
    await syncAdsActionsAndAlert({ tenantId, userId: input.user.id, summary });
    return { importedCount, duplicate: false, summary };
  } catch (error) {
    await db.prepare("DELETE FROM ad_performance_rows WHERE source_import_id = ?1 AND tenant_id = ?2").bind(importId, tenantId).run().catch(() => undefined);
    await db.prepare("UPDATE data_imports SET status = 'failed', failed_at = ?2, last_error_code = 'ads_import_failed' WHERE id = ?1 AND tenant_id = ?3")
      .bind(importId, new Date().toISOString(), tenantId).run().catch(() => undefined);
    // If a replacement failed before completion, reactivate the prior rows.
    for (const prior of overlaps) {
      await db.prepare("UPDATE ad_performance_rows SET is_active = 1, superseded_at = NULL WHERE source_import_id = ?1 AND tenant_id = ?2")
        .bind(prior.id, tenantId).run().catch(() => undefined);
      await db.prepare("UPDATE data_imports SET superseded_by_import_id = NULL WHERE id = ?1 AND tenant_id = ?2 AND superseded_by_import_id = ?3")
        .bind(prior.id, tenantId, importId).run().catch(() => undefined);
    }
    throw error;
  }
}

export async function saveAdsPreferences(input: { user: SessionUser; preAdMarginBps?: number; returnLossBps?: number }): Promise<AdsWorkspaceSummary> {
  const tenantId = await ensureTenantForUser(input.user);
  const preAdMarginBps = input.preAdMarginBps === undefined ? undefined : Number(input.preAdMarginBps);
  const returnLossBps = input.returnLossBps === undefined ? 0 : Number(input.returnLossBps);
  if (preAdMarginBps !== undefined && (!Number.isInteger(preAdMarginBps) || preAdMarginBps < 1 || preAdMarginBps > 10_000)) throw new Error("Pre-ad contribution margin must be between 0.01% and 100%.");
  if (!Number.isInteger(returnLossBps) || returnLossBps < 0 || returnLossBps > 10_000) throw new Error("Return/RTO loss rate must be between 0% and 100%.");
  if (preAdMarginBps !== undefined && returnLossBps > preAdMarginBps) throw new Error("Return/RTO loss cannot exceed the supplied pre-ad contribution margin.");
  const now = new Date().toISOString();
  await getD1().prepare(`
    INSERT INTO ad_preferences (tenant_id, pre_ad_margin_bps, return_loss_bps, updated_at)
    VALUES (?1, ?2, ?3, ?4)
    ON CONFLICT(tenant_id) DO UPDATE SET
      pre_ad_margin_bps = excluded.pre_ad_margin_bps,
      return_loss_bps = excluded.return_loss_bps,
      updated_at = excluded.updated_at
  `).bind(tenantId, preAdMarginBps ?? null, returnLossBps, now).run();
  await writeAdsAudit({ tenantId, userId: input.user.id, action: "ads.preferences.updated", metadata: { preAdMarginBps, returnLossBps } });
  const summary = await getAdsSummary(input.user);
  await syncAdsActionsAndAlert({ tenantId, userId: input.user.id, summary });
  return summary;
}
