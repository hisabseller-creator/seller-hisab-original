import { financeCoverageConfirmed, type SourceCoverage } from "@/core/connectors/coverage";
import { parseFinancialDate } from "@/core/dates";
import { buildKnownCommitmentForecast, reconcileCashPayouts, type CashBankTransaction, type ExpectedPayout } from "@/core/cash/reconciliation";
import { assertPaise, sumPaise } from "@/core/money";
import type { MoneyPaise } from "@/core/types";
import type { SessionUser } from "./auth";
import { randomId, sha256 } from "./crypto";
import { ensureTenantForUser } from "./connectors/store";
import { getD1 } from "./runtime";

export type NormalizedBankTransactionInput = {
  rowKey: string;
  bookedAt: string;
  amountPaise: number;
  direction: "credit" | "debit";
  currency: string;
  reference?: string;
  description?: string;
  closingBalancePaise?: number;
  sourceRow: number;
};

type BankRow = CashBankTransaction & {
  sourceImportId: string;
  rowKey: string;
  transactionFingerprint?: string;
  closingBalancePaise?: MoneyPaise;
  sourceRow: number;
};

type ExpectedLedgerRow = {
  id: string;
  channelAccountId: string | null;
  channelLabel: string | null;
  amountPaise: number;
  currency: string;
  occurredAt: string | null;
  sourceReferenceJson: string | null;
  coverageJson: string | null;
};

export type CashSummary = {
  bankTransactionCount: number;
  totalCreditsPaise: MoneyPaise;
  totalDebitsPaise: MoneyPaise;
  netCashMovementPaise: MoneyPaise;
  matchedPayoutPaise: MoneyPaise;
  cashAtRiskPaise: MoneyPaise;
  cashPendingPaise: MoneyPaise;
  unmatchedCreditPaise: MoneyPaise;
  matches: ReturnType<typeof reconcileCashPayouts>["matches"];
  unmatchedCredits: Array<CashBankTransaction & { sourceRow: number }>;
  latestBankImport?: { fileName: string | null; coverageStart: string | null; coverageEnd: string | null; createdAt: string };
  preferences: { currentBalancePaise?: MoneyPaise; weeklyFixedOutflowPaise?: MoneyPaise };
  forecast: ReturnType<typeof buildKnownCommitmentForecast>;
  latestConfirmedContributionPaise?: MoneyPaise;
};

function safeText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
}

function safeIso(value: unknown): string | undefined {
  return parseFinancialDate(value, { numericDateOrder: "dmy", assumeUtcForTimezoneLessIso: true });
}

function validateTransaction(input: NormalizedBankTransactionInput): NormalizedBankTransactionInput | null {
  const bookedAt = safeIso(input.bookedAt);
  const rowKey = safeText(input.rowKey, 220);
  if (!bookedAt || !rowKey) return null;
  if (input.direction !== "credit" && input.direction !== "debit") return null;
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) return null;
  const currency = safeText(input.currency, 8)?.toUpperCase();
  if (currency !== "INR") return null;
  const closingBalancePaise = input.closingBalancePaise;
  if (closingBalancePaise !== undefined && !Number.isSafeInteger(closingBalancePaise)) return null;
  const sourceRow = Number(input.sourceRow);
  if (!Number.isInteger(sourceRow) || sourceRow < 1 || sourceRow > 2_000_000) return null;
  return {
    rowKey,
    bookedAt,
    amountPaise: input.amountPaise,
    direction: input.direction,
    currency,
    reference: safeText(input.reference, 100),
    description: safeText(input.description, 180),
    closingBalancePaise,
    sourceRow,
  };
}

function parseSourceReference(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

async function writeCashAudit(input: { tenantId: string; userId: string; action: string; resourceId?: string; metadata?: Record<string, unknown> }) {
  await getD1().prepare(`
    INSERT INTO audit_events (id, tenant_id, user_id, action, resource_type, resource_id, metadata_json, created_at)
    VALUES (?1, ?2, ?3, ?4, 'cash', ?5, ?6, ?7)
  `).bind(randomId("aud"), input.tenantId, input.userId, input.action, input.resourceId ?? null, input.metadata ? JSON.stringify(input.metadata) : null, new Date().toISOString()).run();
}

async function loadBankRows(tenantId: string): Promise<BankRow[]> {
  const db = getD1();
  const output: BankRow[] = [];
  const pageSize = 5000;
  const hardLimit = 100_000;
  for (let offset = 0; offset < hardLimit; offset += pageSize) {
    const rows = await db.prepare(`
      SELECT bt.id, bt.source_import_id AS sourceImportId, bt.row_key AS rowKey, bt.transaction_fingerprint AS transactionFingerprint,
             bt.booked_at AS bookedAt, bt.amount_paise AS amountPaise, bt.direction, bt.currency, bt.reference, bt.description,
             bt.closing_balance_paise AS closingBalancePaise, bt.source_row AS sourceRow
      FROM bank_transactions bt
      JOIN data_imports di ON di.id = bt.source_import_id AND di.tenant_id = bt.tenant_id
      WHERE bt.tenant_id = ?1 AND bt.is_active = 1 AND di.status = 'completed'
      ORDER BY bt.booked_at DESC, bt.source_row DESC, bt.id DESC
      LIMIT ?2 OFFSET ?3
    `).bind(tenantId, pageSize, offset).all<{
      id: string; sourceImportId: string; rowKey: string; transactionFingerprint: string; bookedAt: string; amountPaise: number; direction: string;
      currency: string; reference: string | null; description: string | null; closingBalancePaise: number | null; sourceRow: number;
    }>();
    const page = rows.results ?? [];
    output.push(...page.map((row) => ({
      id: row.id,
      sourceImportId: row.sourceImportId,
      rowKey: row.rowKey,
      transactionFingerprint: row.transactionFingerprint,
      bookedAt: row.bookedAt,
      amountPaise: assertPaise(Math.abs(row.amountPaise)),
      direction: row.direction === "debit" ? "debit" as const : "credit" as const,
      currency: row.currency,
      reference: row.reference ?? undefined,
      description: row.description ?? undefined,
      closingBalancePaise: row.closingBalancePaise === null ? undefined : assertPaise(row.closingBalancePaise),
      sourceRow: row.sourceRow,
    })));
    if (page.length < pageSize) return output;
  }
  throw new Error("Bank history exceeds the current 100,000-row safety window. Narrow or archive the workspace period before calculating cash truth.");
}

async function loadExpectedPayouts(tenantId: string): Promise<ExpectedPayout[]> {
  const db = getD1();
  const raw: ExpectedLedgerRow[] = [];
  const pageSize = 2000;
  const hardLimit = 20_000;
  for (let offset = 0; offset < hardLimit; offset += pageSize) {
    const rows = await db.prepare(`
      SELECT le.id,
             le.channel_account_id AS channelAccountId,
             COALESCE(ca.display_name, ca.channel_id) AS channelLabel,
             le.amount_paise AS amountPaise,
             le.currency,
             le.occurred_at AS occurredAt,
             le.source_reference_json AS sourceReferenceJson,
             csj.coverage_json AS coverageJson
      FROM commerce_ledger_entries le
      LEFT JOIN channel_accounts ca ON ca.id = le.channel_account_id AND ca.tenant_id = le.tenant_id
      LEFT JOIN connector_sync_jobs csj ON csj.id = json_extract(le.source_reference_json, '$.coverageJobId') AND csj.tenant_id = le.tenant_id
      WHERE le.tenant_id = ?1
        AND le.semantic = 'api-observation:payout-expected'
        AND le.amount_paise > 0
      ORDER BY le.occurred_at DESC, le.id DESC
      LIMIT ?2 OFFSET ?3
    `).bind(tenantId, pageSize, offset).all<ExpectedLedgerRow>();
    const page = rows.results ?? [];
    raw.push(...page);
    if (page.length < pageSize) break;
    if (offset + pageSize >= hardLimit) throw new Error("Expected payout history exceeds the current 20,000-row safety window. Narrow the workspace period before reconciling cash.");
  }
  return raw.map((row) => {
    const source = parseSourceReference(row.sourceReferenceJson);
    const externalReference = typeof source.externalBatchId === "string" ? source.externalBatchId : undefined;
    const expectedBankBy = typeof source.expectedBankBy === "string" ? safeIso(source.expectedBankBy) : undefined;
    return {
      id: row.id,
      channelAccountId: row.channelAccountId ?? undefined,
      channelLabel: row.channelLabel ?? undefined,
      externalReference,
      referenceKeys: strings(source.referenceKeys),
      expectedAmountPaise: assertPaise(row.amountPaise),
      sourceCoverageComplete: financeCoverageConfirmed(row.coverageJson ? JSON.parse(row.coverageJson) as SourceCoverage : null),
      currency: row.currency || "INR",
      occurredAt: row.occurredAt ?? undefined,
      expectedBankBy,
    };
  });
}

async function bankCoverage(tenantId: string): Promise<{ start?: string; end?: string }> {
  const row = await getD1().prepare(`
    SELECT MIN(COALESCE(di.coverage_start, bt.booked_at)) AS startDate,
           MAX(COALESCE(di.coverage_end, bt.booked_at)) AS endDate
    FROM bank_transactions bt
    JOIN data_imports di ON di.id = bt.source_import_id AND di.tenant_id = bt.tenant_id
    WHERE bt.tenant_id = ?1 AND bt.is_active = 1 AND di.status = 'completed'
  `).bind(tenantId).first<{ startDate: string | null; endDate: string | null }>();
  return { start: row?.startDate ?? undefined, end: row?.endDate ?? undefined };
}

async function persistCashMatches(tenantId: string, matches: ReturnType<typeof reconcileCashPayouts>["matches"]) {
  const db = getD1();
  await db.prepare("DELETE FROM cash_matches WHERE tenant_id = ?1").bind(tenantId).run();
  const statements: D1PreparedStatement[] = [];
  const now = new Date().toISOString();
  for (const item of matches) {
    if (!item.bankTransactionId) continue;
    const id = `cm_${(await sha256(`${tenantId}:${item.expectedId}:${item.bankTransactionId}`)).slice(0, 28)}`;
    statements.push(db.prepare(`
      INSERT INTO cash_matches
        (id, tenant_id, bank_transaction_id, expected_ledger_entry_id, status, match_method, expected_paise, actual_paise, difference_paise, reason, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)
    `).bind(
      id,
      tenantId,
      item.bankTransactionId,
      item.expectedId,
      item.status,
      item.matchMethod ?? null,
      item.expectedPaise,
      item.actualPaise ?? null,
      item.differencePaise ?? null,
      item.why,
      now,
    ));
  }
  for (let index = 0; index < statements.length; index += 50) await db.batch(statements.slice(index, index + 50));
}


async function syncCashActionsAndAlert(input: {
  tenantId: string;
  userId: string;
  matches: ReturnType<typeof reconcileCashPayouts>["matches"];
  cashAtRiskPaise: MoneyPaise;
}) {
  const db = getD1();
  await db.batch([
    db.prepare("DELETE FROM action_recommendations WHERE tenant_id = ?1 AND action_type LIKE 'cash.%' AND status = 'open'").bind(input.tenantId),
    db.prepare("DELETE FROM alerts WHERE user_id = ?1 AND type = 'cash-reconciliation' AND status = 'open'").bind(input.userId),
  ]);
  const now = new Date().toISOString();
  const actionStatements: D1PreparedStatement[] = [];
  for (const item of input.matches.filter((match) => match.status === "missing" || match.status === "short" || match.status === "ambiguous")) {
    const actionType = item.status === "missing" ? "cash.review-missing-payout" : item.status === "short" ? "cash.review-short-payout" : "cash.resolve-ambiguous-payout";
    const impact = item.status === "short" ? Math.max(0, -Number(item.differencePaise ?? 0)) : item.expectedPaise;
    const id = `act_${(await sha256(`${input.tenantId}:${actionType}:${item.expectedId}`)).slice(0, 28)}`;
    actionStatements.push(db.prepare(`
      INSERT INTO action_recommendations
        (id, tenant_id, channel_account_id, target_type, target_id, action_type, expected_impact_paise, confidence_bps, evidence_json, status, created_at, updated_at)
      VALUES (?1, ?2, ?3, 'settlement', ?4, ?5, ?6, ?7, ?8, 'open', ?9, ?9)
      ON CONFLICT(id) DO UPDATE SET
        expected_impact_paise = excluded.expected_impact_paise,
        confidence_bps = excluded.confidence_bps,
        evidence_json = excluded.evidence_json,
        status = CASE WHEN action_recommendations.status IN ('done','dismissed') THEN action_recommendations.status ELSE 'open' END,
        updated_at = excluded.updated_at
    `).bind(
      id,
      input.tenantId,
      item.channelAccountId ?? null,
      item.expectedId,
      actionType,
      impact,
      item.status === "ambiguous" ? 7000 : 9500,
      JSON.stringify({ status: item.status, externalReference: item.externalReference, reason: item.why, expectedPaise: item.expectedPaise, actualPaise: item.actualPaise }),
      now,
    ));
  }
  for (let index = 0; index < actionStatements.length; index += 50) await db.batch(actionStatements.slice(index, index + 50));
  if (input.cashAtRiskPaise > 0) {
    await db.prepare(`
      INSERT INTO alerts (id, user_id, type, message, status, created_at)
      VALUES (?1, ?2, 'cash-reconciliation', ?3, 'open', ?4)
    `).bind(randomId("alt"), input.userId, `${formatRiskRupees(input.cashAtRiskPaise)} cash is at risk across missing, short or ambiguous payout-to-bank matches.`, now).run();
  }
}

function formatRiskRupees(paise: MoneyPaise): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

async function latestConfirmedContribution(userId: string): Promise<MoneyPaise | undefined> {
  const row = await getD1().prepare(`
    SELECT summary_json AS summaryJson
    FROM analyses
    WHERE user_id = ?1
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(userId).first<{ summaryJson: string }>();
  if (!row?.summaryJson) return undefined;
  try {
    const parsed = JSON.parse(row.summaryJson) as { confirmedContributionPaise?: unknown };
    return Number.isSafeInteger(parsed.confirmedContributionPaise) ? assertPaise(Number(parsed.confirmedContributionPaise)) : undefined;
  } catch {
    return undefined;
  }
}

export async function importBankTransactions(input: {
  user: SessionUser;
  fileName: string;
  sourceFingerprint: string;
  coverageStart?: string;
  coverageEnd?: string;
  transactions: NormalizedBankTransactionInput[];
}): Promise<{ importedCount: number; duplicate: boolean; summary: CashSummary }> {
  const tenantId = await ensureTenantForUser(input.user);
  const fingerprint = input.sourceFingerprint.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error("Bank file fingerprint is invalid.");
  const fileName = safeText(input.fileName, 160);
  if (!fileName) throw new Error("Bank file name is required.");
  if (!Array.isArray(input.transactions) || input.transactions.length < 1 || input.transactions.length > 5000) {
    throw new Error("Bank import must contain 1 to 5,000 normalized transactions.");
  }
  const transactions = input.transactions.map(validateTransaction).filter((item): item is NormalizedBankTransactionInput => Boolean(item));
  if (!transactions.length) throw new Error("No valid normalized bank transactions were supplied.");

  const db = getD1();
  const existing = await db.prepare(`
    SELECT id, status FROM data_imports WHERE tenant_id = ?1 AND source_fingerprint = ?2 LIMIT 1
  `).bind(tenantId, fingerprint).first<{ id: string; status: string }>();
  if (existing?.id && existing.status === "completed") {
    return { importedCount: 0, duplicate: true, summary: await getCashSummary(input.user) };
  }

  const importId = existing?.id ?? `imp_${(await sha256(`${tenantId}:bank:${fingerprint}`)).slice(0, 28)}`;
  const now = new Date().toISOString();
  const coverageStart = safeIso(input.coverageStart) ?? transactions.map((x) => x.bookedAt).sort()[0];
  const coverageEnd = safeIso(input.coverageEnd) ?? transactions.map((x) => x.bookedAt).sort().at(-1);
  if (coverageStart && coverageEnd && coverageStart > coverageEnd) throw new Error("Bank coverage start must not be after coverage end.");

  if (existing?.id) {
    await db.prepare("DELETE FROM bank_transactions WHERE source_import_id = ?1 AND tenant_id = ?2").bind(importId, tenantId).run();
    await db.prepare(`
      UPDATE data_imports SET status = 'in_progress', original_file_name = ?3, coverage_start = ?4, coverage_end = ?5,
        failed_at = NULL, completed_at = NULL, last_error_code = NULL
      WHERE id = ?1 AND tenant_id = ?2
    `).bind(importId, tenantId, fileName, coverageStart ?? null, coverageEnd ?? null).run();
  } else {
    await db.prepare(`
      INSERT INTO data_imports
        (id, tenant_id, user_id, source_kind, connector_id, parser_version, original_file_name, source_fingerprint, coverage_start, coverage_end, status, issue_count, created_at)
      VALUES (?1, ?2, ?3, 'file', 'bank-file-v1', 'bank-parser-v2', ?4, ?5, ?6, ?7, 'in_progress', 0, ?8)
    `).bind(importId, tenantId, input.user.id, fileName, fingerprint, coverageStart ?? null, coverageEnd ?? null, now).run();
  }

  let importedCount = 0;
  try {
    for (const transaction of transactions) {
      const logicalKey = await sha256(JSON.stringify([
        transaction.bookedAt,
        transaction.direction,
        transaction.currency,
        (transaction.reference ?? "").trim().toUpperCase(),
        (transaction.description ?? "").trim().toUpperCase(),
        transaction.sourceRow,
      ]));
      const transactionFingerprint = await sha256(JSON.stringify([
        transaction.bookedAt,
        transaction.amountPaise,
        transaction.direction,
        transaction.currency,
        transaction.reference ?? "",
        transaction.description ?? "",
        transaction.closingBalancePaise ?? "",
      ]));
      const identical = await db.prepare(`
        SELECT id FROM bank_transactions WHERE tenant_id = ?1 AND transaction_fingerprint = ?2 LIMIT 1
      `).bind(tenantId, transactionFingerprint).first<{ id: string }>();
      if (identical?.id) {
        await db.prepare(`UPDATE bank_transactions SET is_active = 1, superseded_at = NULL, logical_key = COALESCE(logical_key, ?3) WHERE id = ?1 AND tenant_id = ?2`)
          .bind(identical.id, tenantId, logicalKey).run();
        continue;
      }
      await db.prepare(`
        UPDATE bank_transactions SET is_active = 0, superseded_at = ?3
        WHERE tenant_id = ?1 AND logical_key = ?2 AND is_active = 1
      `).bind(tenantId, logicalKey, now).run();
      const id = `btx_${(await sha256(`${tenantId}:${fingerprint}:${transaction.rowKey}`)).slice(0, 28)}`;
      await db.prepare(`
        INSERT INTO bank_transactions
          (id, tenant_id, user_id, source_import_id, row_key, transaction_fingerprint, booked_at, amount_paise, direction, currency, reference, description, closing_balance_paise, source_row, created_at, logical_key, is_active)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, 1)
      `).bind(
        id, tenantId, input.user.id, importId, transaction.rowKey, transactionFingerprint, transaction.bookedAt,
        transaction.amountPaise, transaction.direction, transaction.currency, transaction.reference ?? null,
        transaction.description ?? null, transaction.closingBalancePaise ?? null, transaction.sourceRow, now, logicalKey,
      ).run();
      importedCount += 1;
    }
    await db.prepare(`UPDATE data_imports SET status = 'completed', completed_at = ?2 WHERE id = ?1 AND tenant_id = ?3`)
      .bind(importId, new Date().toISOString(), tenantId).run();
    await refreshCashReconciliation(input.user);
    await writeCashAudit({ tenantId, userId: input.user.id, action: "cash.bank_import.completed", resourceId: importId, metadata: { fileName, normalizedRows: transactions.length, importedCount, coverageStart, coverageEnd } });
    return { importedCount, duplicate: false, summary: await getCashSummary(input.user) };
  } catch (error) {
    await db.prepare(`UPDATE data_imports SET status = 'failed', failed_at = ?2, last_error_code = 'bank_import_failed' WHERE id = ?1 AND tenant_id = ?3`)
      .bind(importId, new Date().toISOString(), tenantId).run();
    throw error;
  }
}

export async function refreshCashReconciliation(user: SessionUser): Promise<void> {
  const tenantId = await ensureTenantForUser(user);
  const [bankRows, expectedPayouts, coverage] = await Promise.all([loadBankRows(tenantId), loadExpectedPayouts(tenantId), bankCoverage(tenantId)]);
  const reconciliation = reconcileCashPayouts({ expectedPayouts, bankTransactions: bankRows, bankCoverage: coverage });
  await persistCashMatches(tenantId, reconciliation.matches);
  await syncCashActionsAndAlert({ tenantId, userId: user.id, matches: reconciliation.matches, cashAtRiskPaise: reconciliation.atRiskPayoutPaise });
}

export async function saveCashPreferences(input: {
  user: SessionUser;
  currentBalancePaise?: number;
  weeklyFixedOutflowPaise?: number;
}): Promise<CashSummary> {
  const tenantId = await ensureTenantForUser(input.user);
  const currentBalance = input.currentBalancePaise;
  const weeklyOutflow = input.weeklyFixedOutflowPaise;
  if (currentBalance !== undefined && !Number.isSafeInteger(currentBalance)) throw new Error("Current balance is invalid.");
  if (weeklyOutflow !== undefined && (!Number.isSafeInteger(weeklyOutflow) || weeklyOutflow < 0)) throw new Error("Weekly fixed outflow is invalid.");
  const now = new Date().toISOString();
  await getD1().prepare(`
    INSERT INTO cash_preferences (tenant_id, current_balance_paise, weekly_fixed_outflow_paise, updated_at)
    VALUES (?1, ?2, ?3, ?4)
    ON CONFLICT(tenant_id) DO UPDATE SET
      current_balance_paise = excluded.current_balance_paise,
      weekly_fixed_outflow_paise = excluded.weekly_fixed_outflow_paise,
      updated_at = excluded.updated_at
  `).bind(tenantId, currentBalance ?? null, weeklyOutflow ?? null, now).run();
  await writeCashAudit({ tenantId, userId: input.user.id, action: "cash.preferences.updated" });
  await refreshCashReconciliation(input.user);
  return getCashSummary(input.user);
}

export async function getCashSummary(user: SessionUser): Promise<CashSummary> {
  const tenantId = await ensureTenantForUser(user);
  const [bankRows, expectedPayouts, coverage] = await Promise.all([loadBankRows(tenantId), loadExpectedPayouts(tenantId), bankCoverage(tenantId)]);
  const reconciliation = reconcileCashPayouts({ expectedPayouts, bankTransactions: bankRows, bankCoverage: coverage });

  const credits = bankRows.filter((item) => item.direction === "credit");
  const debits = bankRows.filter((item) => item.direction === "debit");
  const totalCreditsPaise = sumPaise(credits.map((item) => item.amountPaise));
  const totalDebitsPaise = sumPaise(debits.map((item) => item.amountPaise));
  const netCashMovementPaise = assertPaise(totalCreditsPaise - totalDebitsPaise);

  const latestBankImport = await getD1().prepare(`
    SELECT original_file_name AS fileName, coverage_start AS coverageStart, coverage_end AS coverageEnd, created_at AS createdAt
    FROM data_imports
    WHERE tenant_id = ?1 AND connector_id = 'bank-file-v1' AND status = 'completed'
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(tenantId).first<{ fileName: string | null; coverageStart: string | null; coverageEnd: string | null; createdAt: string }>();

  const preference = await getD1().prepare(`
    SELECT current_balance_paise AS currentBalancePaise, weekly_fixed_outflow_paise AS weeklyFixedOutflowPaise
    FROM cash_preferences WHERE tenant_id = ?1
  `).bind(tenantId).first<{ currentBalancePaise: number | null; weeklyFixedOutflowPaise: number | null }>();
  const preferences = {
    currentBalancePaise: preference?.currentBalancePaise === null || preference?.currentBalancePaise === undefined ? undefined : assertPaise(preference.currentBalancePaise),
    weeklyFixedOutflowPaise: preference?.weeklyFixedOutflowPaise === null || preference?.weeklyFixedOutflowPaise === undefined ? undefined : assertPaise(preference.weeklyFixedOutflowPaise),
  };

  return {
    bankTransactionCount: bankRows.length,
    totalCreditsPaise,
    totalDebitsPaise,
    netCashMovementPaise,
    matchedPayoutPaise: reconciliation.matchedPayoutPaise,
    cashAtRiskPaise: reconciliation.atRiskPayoutPaise,
    cashPendingPaise: reconciliation.pendingPayoutPaise,
    unmatchedCreditPaise: reconciliation.unmatchedCreditPaise,
    matches: reconciliation.matches.slice(0, 100),
    unmatchedCredits: reconciliation.unmatchedCredits.slice(0, 50).map((item) => ({ ...item, sourceRow: bankRows.find((row) => row.id === item.id)?.sourceRow ?? 0 })),
    latestBankImport: latestBankImport ?? undefined,
    preferences,
    forecast: buildKnownCommitmentForecast(preferences),
    latestConfirmedContributionPaise: await latestConfirmedContribution(user.id),
  };
}
