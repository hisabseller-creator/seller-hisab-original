import { parseFinancialDate } from "@/core/dates";
import { buildInventoryEconomicsSummary, DEFAULT_INVENTORY_PREFERENCES, type InventoryEconomicsRow, type InventoryEconomicsSummary, type InventoryPreferences, type InventoryPositionEconomics } from "@/core/inventory/economics";
import { assertPaise } from "@/core/money";
import type { SessionUser } from "./auth";
import { randomId, sha256 } from "./crypto";
import { ensureTenantForUser } from "./connectors/store";
import { getD1 } from "./runtime";

const SUPPORTED_CHANNELS = new Set(["amazon-in", "flipkart", "meesho", "shopify"]);

export type NormalizedInventoryInput = {
  rowKey: string;
  snapshotDate: string;
  sku: string;
  masterSku?: string;
  productName?: string;
  availableUnits: number;
  inboundUnits?: number;
  unitsSold30d?: number;
  leadTimeDays?: number;
  unitCostPaise?: number;
  contributionMarginBps?: number;
  location?: string;
  sourceRow: number;
};

export type InventoryWorkspaceSummary = InventoryEconomicsSummary & {
  latestImport?: { fileName: string | null; channelId: string | null; coverageStart: string | null; coverageEnd: string | null; createdAt: string };
};

type StoredInventoryRow = InventoryEconomicsRow & { sourceImportId: string; createdAt: string };

function safeText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
}

function safeIso(value: unknown): string | undefined {
  return parseFinancialDate(value, { numericDateOrder: "dmy", assumeUtcForTimezoneLessIso: true });
}

function safeInteger(value: unknown, max = 1_000_000_000): number | undefined {
  if (value === undefined || value === null) return undefined;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= max ? number : undefined;
}

function validateRow(input: NormalizedInventoryInput): NormalizedInventoryInput | null {
  const rowKey = safeText(input.rowKey, 260);
  const snapshotDate = safeIso(input.snapshotDate);
  const sku = safeText(input.sku, 120);
  const availableUnits = safeInteger(input.availableUnits);
  const sourceRow = safeInteger(input.sourceRow, 2_000_000);
  if (!rowKey || !snapshotDate || !sku || availableUnits === undefined || sourceRow === undefined || sourceRow < 1) return null;
  const unitCostPaise = input.unitCostPaise === undefined ? undefined : safeInteger(input.unitCostPaise, Number.MAX_SAFE_INTEGER);
  const contributionMarginBps = input.contributionMarginBps === undefined ? undefined : safeInteger(input.contributionMarginBps, 10_000);
  return {
    rowKey,
    snapshotDate,
    sku,
    masterSku: safeText(input.masterSku, 120),
    productName: safeText(input.productName, 180),
    availableUnits,
    inboundUnits: safeInteger(input.inboundUnits),
    unitsSold30d: safeInteger(input.unitsSold30d),
    leadTimeDays: safeInteger(input.leadTimeDays, 3650),
    unitCostPaise,
    contributionMarginBps,
    location: safeText(input.location, 120),
    sourceRow,
  };
}

async function loadLatestRows(tenantId: string): Promise<StoredInventoryRow[]> {
  const db = getD1();
  const latest = new Map<string, StoredInventoryRow>();
  const pageSize = 5_000;
  const hardLimit = 100_000;
  for (let offset = 0; offset < hardLimit; offset += pageSize) {
    const result = await db.prepare(`
      SELECT ipr.id, ipr.source_import_id AS sourceImportId, ipr.snapshot_date AS snapshotDate, ipr.channel_id AS channelId,
             ipr.sku, ipr.master_sku AS masterSku, ipr.product_name AS productName, ipr.available_units AS availableUnits,
             ipr.inbound_units AS inboundUnits, ipr.units_sold_30d AS unitsSold30d, ipr.lead_time_days AS leadTimeDays,
             ipr.unit_cost_paise AS unitCostPaise, ipr.contribution_margin_bps AS contributionMarginBps,
             ipr.location, ipr.created_at AS createdAt
      FROM inventory_position_rows ipr
      JOIN data_imports di ON di.id = ipr.source_import_id AND di.tenant_id = ipr.tenant_id
      WHERE ipr.tenant_id = ?1 AND ipr.is_active = 1 AND di.status = 'completed'
      ORDER BY ipr.snapshot_date DESC, ipr.created_at DESC, ipr.id DESC
      LIMIT ?2 OFFSET ?3
    `).bind(tenantId, pageSize, offset).all<{
      id: string; sourceImportId: string; snapshotDate: string; channelId: string; sku: string; masterSku: string | null;
      productName: string | null; availableUnits: number; inboundUnits: number | null; unitsSold30d: number | null;
      leadTimeDays: number | null; unitCostPaise: number | null; contributionMarginBps: number | null; location: string | null; createdAt: string;
    }>();
    const page = result.results ?? [];
    for (const row of page) {
      const key = `${row.channelId}:${row.sku.toLowerCase()}:${(row.location ?? "").toLowerCase()}`;
      if (latest.has(key)) continue;
      latest.set(key, {
        id: row.id,
        sourceImportId: row.sourceImportId,
        snapshotDate: row.snapshotDate,
        channelId: row.channelId,
        sku: row.sku,
        masterSku: row.masterSku ?? undefined,
        productName: row.productName ?? undefined,
        availableUnits: row.availableUnits,
        inboundUnits: row.inboundUnits ?? undefined,
        unitsSold30d: row.unitsSold30d ?? undefined,
        leadTimeDays: row.leadTimeDays ?? undefined,
        unitCostPaise: row.unitCostPaise === null ? undefined : assertPaise(row.unitCostPaise),
        contributionMarginBps: row.contributionMarginBps ?? undefined,
        location: row.location ?? undefined,
        createdAt: row.createdAt,
      });
    }
    if (page.length < pageSize) return [...latest.values()];
  }
  throw new Error("Inventory history exceeds the current 100,000-row safety window. Narrow or archive older snapshots before calculating inventory intelligence.");
}

async function loadPreferences(tenantId: string): Promise<InventoryPreferences> {
  const row = await getD1().prepare(`
    SELECT default_lead_time_days AS defaultLeadTimeDays, safety_days AS safetyDays,
           target_cover_days AS targetCoverDays, overstock_days AS overstockDays
    FROM inventory_preferences WHERE tenant_id = ?1
  `).bind(tenantId).first<InventoryPreferences>();
  return row ?? DEFAULT_INVENTORY_PREFERENCES;
}

async function latestImport(tenantId: string): Promise<InventoryWorkspaceSummary["latestImport"]> {
  const row = await getD1().prepare(`
    SELECT original_file_name AS fileName, schema_fingerprint AS schemaFingerprint,
           coverage_start AS coverageStart, coverage_end AS coverageEnd, created_at AS createdAt
    FROM data_imports
    WHERE tenant_id = ?1 AND connector_id = 'inventory-file-v1' AND status = 'completed'
    ORDER BY created_at DESC LIMIT 1
  `).bind(tenantId).first<{ fileName: string | null; schemaFingerprint: string | null; coverageStart: string | null; coverageEnd: string | null; createdAt: string }>();
  if (!row) return undefined;
  let channelId: string | null = null;
  try {
    const parsed = JSON.parse(row.schemaFingerprint ?? "{}") as { channelId?: unknown };
    channelId = typeof parsed.channelId === "string" ? parsed.channelId : null;
  } catch { /* malformed historical metadata stays non-fatal */ }
  return { fileName: row.fileName, channelId, coverageStart: row.coverageStart, coverageEnd: row.coverageEnd, createdAt: row.createdAt };
}

async function writeInventoryAudit(input: { tenantId: string; userId: string; action: string; resourceId?: string; metadata?: Record<string, unknown> }) {
  await getD1().prepare(`
    INSERT INTO audit_events (id, tenant_id, user_id, action, resource_type, resource_id, metadata_json, created_at)
    VALUES (?1, ?2, ?3, ?4, 'inventory', ?5, ?6, ?7)
  `).bind(randomId("aud"), input.tenantId, input.userId, input.action, input.resourceId ?? null, input.metadata ? JSON.stringify(input.metadata) : null, new Date().toISOString()).run();
}

function actionType(position: InventoryPositionEconomics): string | undefined {
  if (position.status === "Stockout") return "inventory.stockout";
  if (position.status === "Reorder now") return "inventory.reorder-now";
  if (position.status === "Overstock review" || position.status === "No recent sales") return "inventory.review-overstock";
  if (position.status === "Add sales history") return "inventory.add-sales-history";
  return undefined;
}

async function syncInventoryActionsAndAlert(input: { tenantId: string; userId: string; summary: InventoryWorkspaceSummary }) {
  const db = getD1();
  await db.batch([
    db.prepare("DELETE FROM action_recommendations WHERE tenant_id = ?1 AND action_type LIKE 'inventory.%' AND status = 'open'").bind(input.tenantId),
    db.prepare("DELETE FROM alerts WHERE user_id = ?1 AND type = 'inventory-intelligence' AND status = 'open'").bind(input.userId),
  ]);
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  for (const position of input.summary.positions.slice(0, 150)) {
    const type = actionType(position);
    if (!type) continue;
    const id = `act_${(await sha256(`${input.tenantId}:${type}:${position.channelId}:${position.sku}:${position.location ?? ""}`)).slice(0, 28)}`;
    statements.push(db.prepare(`
      INSERT INTO action_recommendations
        (id, tenant_id, target_type, target_id, action_type, expected_impact_paise, confidence_bps, evidence_json, status, created_at, updated_at)
      VALUES (?1, ?2, 'inventory-position', ?3, ?4, NULL, ?5, ?6, 'open', ?7, ?7)
      ON CONFLICT(id) DO UPDATE SET confidence_bps = excluded.confidence_bps, evidence_json = excluded.evidence_json, status = CASE WHEN action_recommendations.status IN ('done','dismissed') THEN action_recommendations.status ELSE 'open' END, updated_at = excluded.updated_at
    `).bind(
      id,
      input.tenantId,
      `${position.channelId}:${position.sku}:${position.location ?? ""}`,
      type,
      position.unitsSold30d !== undefined && position.leadTimeSource === "report" ? 9000 : 7000,
      JSON.stringify({
        channelId: position.channelId,
        sku: position.sku,
        masterSku: position.masterSku,
        availableUnits: position.availableUnits,
        inboundUnits: position.inboundUnits,
        unitsSold30d: position.unitsSold30d,
        daysCover: position.daysCover,
        effectiveLeadTimeDays: position.effectiveLeadTimeDays,
        leadTimeSource: position.leadTimeSource,
        suggestedReorderUnits: position.suggestedReorderUnits,
        status: position.status,
        reason: position.reason,
      }),
      now,
    ));
  }

  for (const suggestion of input.summary.allocationSuggestions.slice(0, 50)) {
    const id = `act_${(await sha256(`${input.tenantId}:inventory.review-reallocation:${suggestion.masterSku}:${suggestion.fromChannelId}:${suggestion.toChannelId}`)).slice(0, 28)}`;
    statements.push(db.prepare(`
      INSERT INTO action_recommendations
        (id, tenant_id, target_type, target_id, action_type, expected_impact_paise, confidence_bps, evidence_json, status, created_at, updated_at)
      VALUES (?1, ?2, 'master-sku', ?3, 'inventory.review-reallocation', NULL, 8500, ?4, 'open', ?5, ?5)
      ON CONFLICT(id) DO UPDATE SET evidence_json = excluded.evidence_json, status = CASE WHEN action_recommendations.status IN ('done','dismissed') THEN action_recommendations.status ELSE 'open' END, updated_at = excluded.updated_at
    `).bind(id, input.tenantId, suggestion.masterSku, JSON.stringify(suggestion), now));
  }
  for (let index = 0; index < statements.length; index += 50) await db.batch(statements.slice(index, index + 50));

  const urgent = input.summary.stockoutCount + input.summary.reorderNowCount;
  if (urgent > 0) {
    await db.prepare(`
      INSERT INTO alerts (id, user_id, type, message, status, created_at)
      VALUES (?1, ?2, 'inventory-intelligence', ?3, 'open', ?4)
    `).bind(randomId("alt"), input.userId, `${urgent} inventory position(s) are stocked out or inside the lead-time + safety reorder window. Review replenishment before the risk grows.`, now).run();
  }
}

export async function getInventorySummary(user: SessionUser): Promise<InventoryWorkspaceSummary> {
  const tenantId = await ensureTenantForUser(user);
  const [rows, preferences, latest] = await Promise.all([loadLatestRows(tenantId), loadPreferences(tenantId), latestImport(tenantId)]);
  return { ...buildInventoryEconomicsSummary(rows, preferences), latestImport: latest };
}

export async function importInventoryPositions(input: {
  user: SessionUser;
  channelId: string;
  fileName: string;
  sourceFingerprint: string;
  coverageStart?: string;
  coverageEnd?: string;
  rows: NormalizedInventoryInput[];
}): Promise<{ importedCount: number; duplicate: boolean; summary: InventoryWorkspaceSummary }> {
  if (!SUPPORTED_CHANNELS.has(input.channelId)) throw new Error("Choose a supported F9 channel before importing inventory.");
  const tenantId = await ensureTenantForUser(input.user);
  const rawFingerprint = input.sourceFingerprint.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(rawFingerprint)) throw new Error("Inventory report fingerprint is invalid.");
  const fileName = safeText(input.fileName, 160);
  if (!fileName) throw new Error("Inventory report file name is required.");
  if (!Array.isArray(input.rows) || input.rows.length < 1 || input.rows.length > 20_000) throw new Error("Inventory import must contain 1 to 20,000 normalized rows.");
  const rows = input.rows.map(validateRow).filter((row): row is NormalizedInventoryInput => Boolean(row));
  if (!rows.length) throw new Error("No valid normalized inventory rows were supplied.");

  const sourceFingerprint = await sha256(`inventory:${input.channelId}:${rawFingerprint}`);
  const db = getD1();
  const existing = await db.prepare("SELECT id, status FROM data_imports WHERE tenant_id = ?1 AND source_fingerprint = ?2 LIMIT 1")
    .bind(tenantId, sourceFingerprint).first<{ id: string; status: string }>();
  if (existing?.id && existing.status === "completed") return { importedCount: 0, duplicate: true, summary: await getInventorySummary(input.user) };

  const importId = existing?.id ?? `imp_${(await sha256(`${tenantId}:inventory:${input.channelId}:${rawFingerprint}`)).slice(0, 28)}`;
  const now = new Date().toISOString();
  const dates = rows.map((row) => row.snapshotDate).sort();
  const coverageStart = safeIso(input.coverageStart) ?? dates[0];
  const coverageEnd = safeIso(input.coverageEnd) ?? dates.at(-1);
  if (!coverageStart || !coverageEnd || coverageStart > coverageEnd) throw new Error("Inventory coverage is invalid.");

  if (existing?.id) {
    await db.prepare("DELETE FROM inventory_position_rows WHERE source_import_id = ?1 AND tenant_id = ?2").bind(importId, tenantId).run();
    await db.prepare(`
      UPDATE data_imports SET status = 'in_progress', original_file_name = ?3, schema_fingerprint = ?4,
        coverage_start = ?5, coverage_end = ?6, failed_at = NULL, completed_at = NULL, last_error_code = NULL
      WHERE id = ?1 AND tenant_id = ?2
    `).bind(importId, tenantId, fileName, JSON.stringify({ channelId: input.channelId }), coverageStart, coverageEnd).run();
  } else {
    await db.prepare(`
      INSERT INTO data_imports
        (id, tenant_id, user_id, source_kind, connector_id, parser_version, original_file_name, source_fingerprint, schema_fingerprint, coverage_start, coverage_end, status, issue_count, created_at)
      VALUES (?1, ?2, ?3, 'file', 'inventory-file-v1', 'inventory-parser-v2', ?4, ?5, ?6, ?7, ?8, 'in_progress', 0, ?9)
    `).bind(importId, tenantId, input.user.id, fileName, sourceFingerprint, JSON.stringify({ channelId: input.channelId }), coverageStart, coverageEnd, now).run();
  }

  const exactPrior = await db.prepare(`
    SELECT id FROM data_imports
    WHERE tenant_id = ?1 AND connector_id = 'inventory-file-v1' AND status = 'completed' AND id != ?2
      AND json_extract(COALESCE(schema_fingerprint, '{}'), '$.channelId') = ?3
      AND coverage_start = ?4 AND coverage_end = ?5
  `).bind(tenantId, importId, input.channelId, coverageStart, coverageEnd).all<{ id: string }>();
  const priorIds = (exactPrior.results ?? []).map((row) => row.id);

  try {
    for (const priorId of priorIds) {
      await db.prepare("UPDATE inventory_position_rows SET is_active = 0, superseded_at = ?3 WHERE source_import_id = ?1 AND tenant_id = ?2 AND is_active = 1")
        .bind(priorId, tenantId, now).run();
      await db.prepare("UPDATE data_imports SET superseded_by_import_id = ?2 WHERE id = ?1 AND tenant_id = ?3")
        .bind(priorId, importId, tenantId).run();
    }

    let importedCount = 0;
    for (const row of rows) {
      const logicalKey = await sha256(JSON.stringify([
        input.channelId,
        row.snapshotDate,
        row.sku.trim().toLowerCase(),
        row.location?.trim().toLowerCase() ?? "",
      ]));
      await db.prepare(`
        UPDATE inventory_position_rows SET is_active = 0, superseded_at = ?3
        WHERE tenant_id = ?1 AND logical_key = ?2 AND is_active = 1 AND source_import_id != ?4
      `).bind(tenantId, logicalKey, now, importId).run();
      const id = `inv_${(await sha256(`${tenantId}:${importId}:${row.rowKey}`)).slice(0, 28)}`;
      await db.prepare(`
        INSERT INTO inventory_position_rows
          (id, tenant_id, user_id, source_import_id, row_key, snapshot_date, channel_id, sku, master_sku, product_name,
           available_units, inbound_units, units_sold_30d, lead_time_days, unit_cost_paise, contribution_margin_bps, location,
           source_row, created_at, logical_key, is_active)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, 1)
      `).bind(
        id, tenantId, input.user.id, importId, row.rowKey, row.snapshotDate, input.channelId, row.sku,
        row.masterSku ?? null, row.productName ?? null, row.availableUnits, row.inboundUnits ?? null, row.unitsSold30d ?? null,
        row.leadTimeDays ?? null, row.unitCostPaise ?? null, row.contributionMarginBps ?? null, row.location ?? null,
        row.sourceRow, now, logicalKey,
      ).run();
      importedCount += 1;
    }
    await db.prepare("UPDATE data_imports SET status = 'completed', completed_at = ?2 WHERE id = ?1 AND tenant_id = ?3")
      .bind(importId, new Date().toISOString(), tenantId).run();
    await writeInventoryAudit({ tenantId, userId: input.user.id, action: "inventory.import.completed", resourceId: importId, metadata: { fileName, channelId: input.channelId, normalizedRows: rows.length, importedCount, coverageStart, coverageEnd, replacementImports: priorIds } });
    const summary = await getInventorySummary(input.user);
    await syncInventoryActionsAndAlert({ tenantId, userId: input.user.id, summary });
    return { importedCount, duplicate: false, summary };
  } catch (error) {
    await db.prepare("DELETE FROM inventory_position_rows WHERE source_import_id = ?1 AND tenant_id = ?2").bind(importId, tenantId).run().catch(() => undefined);
    await db.prepare("UPDATE data_imports SET status = 'failed', failed_at = ?2, last_error_code = 'inventory_import_failed' WHERE id = ?1 AND tenant_id = ?3")
      .bind(importId, new Date().toISOString(), tenantId).run().catch(() => undefined);
    for (const priorId of priorIds) {
      await db.prepare("UPDATE inventory_position_rows SET is_active = 1, superseded_at = NULL WHERE source_import_id = ?1 AND tenant_id = ?2")
        .bind(priorId, tenantId).run().catch(() => undefined);
      await db.prepare("UPDATE data_imports SET superseded_by_import_id = NULL WHERE id = ?1 AND tenant_id = ?2 AND superseded_by_import_id = ?3")
        .bind(priorId, tenantId, importId).run().catch(() => undefined);
    }
    throw error;
  }
}

export async function saveInventoryPreferences(input: { user: SessionUser; preferences: Partial<InventoryPreferences> }): Promise<InventoryWorkspaceSummary> {
  const tenantId = await ensureTenantForUser(input.user);
  const current = await loadPreferences(tenantId);
  const preferences: InventoryPreferences = {
    defaultLeadTimeDays: Number(input.preferences.defaultLeadTimeDays ?? current.defaultLeadTimeDays),
    safetyDays: Number(input.preferences.safetyDays ?? current.safetyDays),
    targetCoverDays: Number(input.preferences.targetCoverDays ?? current.targetCoverDays),
    overstockDays: Number(input.preferences.overstockDays ?? current.overstockDays),
  };
  if (!Number.isInteger(preferences.defaultLeadTimeDays) || preferences.defaultLeadTimeDays < 1 || preferences.defaultLeadTimeDays > 365) throw new Error("Default lead time must be 1 to 365 days.");
  if (!Number.isInteger(preferences.safetyDays) || preferences.safetyDays < 0 || preferences.safetyDays > 180) throw new Error("Safety buffer must be 0 to 180 days.");
  if (!Number.isInteger(preferences.targetCoverDays) || preferences.targetCoverDays < 1 || preferences.targetCoverDays > 365) throw new Error("Target cover must be 1 to 365 days.");
  if (!Number.isInteger(preferences.overstockDays) || preferences.overstockDays < 30 || preferences.overstockDays > 730) throw new Error("Overstock review threshold must be 30 to 730 days.");
  if (preferences.overstockDays <= preferences.targetCoverDays) throw new Error("Overstock review threshold must be above target cover days.");
  const now = new Date().toISOString();
  await getD1().prepare(`
    INSERT INTO inventory_preferences (tenant_id, default_lead_time_days, safety_days, target_cover_days, overstock_days, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    ON CONFLICT(tenant_id) DO UPDATE SET
      default_lead_time_days = excluded.default_lead_time_days,
      safety_days = excluded.safety_days,
      target_cover_days = excluded.target_cover_days,
      overstock_days = excluded.overstock_days,
      updated_at = excluded.updated_at
  `).bind(tenantId, preferences.defaultLeadTimeDays, preferences.safetyDays, preferences.targetCoverDays, preferences.overstockDays, now).run();
  await writeInventoryAudit({ tenantId, userId: input.user.id, action: "inventory.preferences.updated", metadata: preferences });
  const summary = await getInventorySummary(input.user);
  await syncInventoryActionsAndAlert({ tenantId, userId: input.user.id, summary });
  return summary;
}
