/**
 * Phase 6 — Historical anomaly detection.
 *
 * Read-only detection pass over one business. Reuses the Phase 5
 * reconciliation + integrity engines and adds Phase 6 detectors (duplicate
 * source postings, orphan journals, opening duplication, cross-tenant
 * references, missing period links). Every finding is persisted idempotently
 * into the anomaly registry via a stable detection key — re-running detection
 * never duplicates findings and never regresses workflow state.
 */

import { runLedgerReconciliation } from '../ledger/ledgerReconciliationService.js';
import { POSTED_TRANSACTION_STATUSES, POSTED_JOURNAL_STATUSES } from '../ledger/canonicalJournalSource.js';
import { RULE_TO_ANOMALY_TYPE, ConfidenceLevel, AnomalySeverity } from './repairCatalogue.js';
import { recordAnomaly } from './anomalyRegistryService.js';
import { logAccountingOperation } from '../observability/accountingLogger.js';

/** Source types that legitimately have no operational source document. */
const SOURCELESS_ENTRY_TYPES = new Set(['Adjustment', 'Opening', 'OpeningBalance', 'Reversal']);

function ruleFindingToAnomaly(finding) {
  const anomalyType = RULE_TO_ANOMALY_TYPE[finding.rule] ?? 'OTHER_CONFIRMED_ERROR';
  const target =
    finding.journalEntryId ?? finding.transactionId ?? finding.accountId ?? finding.lineId ?? 'business';
  const impact =
    finding.differenceMinor ?? finding.driftMinor ?? finding.debitMinor ?? null;
  return {
    findingCode: finding.rule,
    anomalyType,
    severity: finding.severity ?? AnomalySeverity.MEDIUM,
    confidence: ConfidenceLevel.CONFIRMED, // measured directly from the data
    journalEntryId: finding.journalEntryId ?? null,
    journalLineId: finding.lineId ?? null,
    accountId: finding.accountId ?? null,
    financialImpactMinor: impact != null ? BigInt(Math.trunc(Number(impact))) : null,
    expectedCondition: finding.description ?? null,
    actualCondition: summarize(finding),
    detectionKey: `${finding.rule}:${target}`,
    metadata: JSON.parse(JSON.stringify(finding, (k, v) => (typeof v === 'bigint' ? Number(v) : v))),
  };
}

function summarize(finding) {
  const parts = [];
  for (const key of ['debitMinor', 'creditMinor', 'differenceMinor', 'storedMinor', 'derivedMinor', 'driftMinor', 'rawStatus', 'direction', 'surface']) {
    if (finding[key] !== undefined) parts.push(`${key}=${finding[key]}`);
  }
  return parts.join(' ') || null;
}

/** Detect duplicate active postings for one source (legacy Transaction ledger). */
async function detectDuplicateSourcePostings(db, context) {
  const tenantId = context.businessId;
  const groups = await db.transaction.groupBy({
    by: ['sourceType', 'sourceId'],
    where: {
      tenantId,
      status: { in: [...POSTED_TRANSACTION_STATUSES] },
      isReversal: false,
      sourceId: { not: null },
      sourceType: { notIn: ['gl_posting'] },
    },
    _count: { _all: true },
  });
  const findings = [];
  for (const g of groups) {
    if (!g.sourceId || (g._count?._all ?? 0) < 2) continue;
    const rows = await db.transaction.findMany({
      where: {
        tenantId,
        sourceType: g.sourceType,
        sourceId: g.sourceId,
        isReversal: false,
        status: { in: [...POSTED_TRANSACTION_STATUSES] },
      },
      include: { lines: true },
    });
    // Same source posted twice is only a DUPLICATE candidate when totals match;
    // differing totals may be legitimate partials and stay MEDIUM confidence.
    const totals = rows.map((r) =>
      r.lines.reduce((s, l) => s + Math.round(Number(l.debitAmount ?? 0) * 100), 0)
    );
    const identical = new Set(totals).size === 1;
    findings.push({
      findingCode: 'P6-DUP-001',
      anomalyType: 'DUPLICATE_JOURNAL',
      severity: AnomalySeverity.CRITICAL,
      confidence: identical ? ConfidenceLevel.HIGH_CONFIDENCE : ConfidenceLevel.MEDIUM_CONFIDENCE,
      sourceType: g.sourceType,
      sourceId: g.sourceId,
      transactionId: rows[0]?.id ?? null,
      financialImpactMinor: identical ? BigInt(totals[0]) : null,
      expectedCondition: 'One active posted transaction per source document.',
      actualCondition: `${rows.length} active posted transactions for ${g.sourceType}:${g.sourceId}`,
      detectionKey: `P6-DUP-001:${g.sourceType}:${g.sourceId}`,
      metadata: { transactionIds: rows.map((r) => r.id), totalsMinor: totals },
    });
  }
  return findings;
}

/** Posted non-mirror journals with no source reference and no sourceless classification. */
async function detectOrphanJournals(db, context) {
  const rows = await db.journalEntry.findMany({
    where: {
      tenantId: context.businessId,
      status: { in: [...POSTED_JOURNAL_STATUSES] },
      transactionId: null,
      sourceType: null,
      sourceId: null,
    },
    take: 2000,
  });
  return rows
    .filter((je) => !SOURCELESS_ENTRY_TYPES.has(je.entryType) && je.architectureVersion !== 'ACCOUNTING_V2')
    .map((je) => ({
      findingCode: 'P6-ORPH-001',
      anomalyType: 'ORPHAN_JOURNAL',
      severity: AnomalySeverity.HIGH,
      confidence: ConfidenceLevel.MEDIUM_CONFIDENCE, // requires classification
      journalEntryId: je.id,
      expectedCondition: 'Posted journal carries a source link or a sourceless classification (manual/opening/adjustment/reversal).',
      actualCondition: `entryType=${je.entryType}, no sourceType/sourceId`,
      detectionKey: `P6-ORPH-001:${je.id}`,
      metadata: { entryType: je.entryType, referenceNumber: je.referenceNumber ?? null },
    }));
}

/** Multiple opening-balance postings hitting the same account. */
async function detectOpeningDuplication(db, context) {
  const tenantId = context.businessId;
  const rows = await db.transaction.findMany({
    where: {
      tenantId,
      status: { in: [...POSTED_TRANSACTION_STATUSES] },
      isReversal: false,
      sourceType: { in: ['onboarding', 'opening_balance', 'liability_opening'] },
    },
    include: { lines: true },
  });
  const byAccount = new Map();
  for (const t of rows) {
    for (const line of t.lines) {
      const list = byAccount.get(line.accountId) ?? [];
      list.push({ transactionId: t.id, sourceType: t.sourceType, date: t.date });
      byAccount.set(line.accountId, list);
    }
  }
  const findings = [];
  for (const [accountId, hits] of byAccount) {
    const distinctTx = [...new Set(hits.map((h) => h.transactionId))];
    if (distinctTx.length < 2) continue;
    findings.push({
      findingCode: 'P6-OPEN-001',
      anomalyType: 'OPENING_BALANCE_DUPLICATION',
      severity: AnomalySeverity.CRITICAL,
      confidence: ConfidenceLevel.MEDIUM_CONFIDENCE, // authoritative batch must be chosen by review
      accountId,
      expectedCondition: 'One opening posting per account.',
      actualCondition: `${distinctTx.length} opening postings touch this account`,
      detectionKey: `P6-OPEN-001:${accountId}`,
      metadata: { transactionIds: distinctTx },
    });
  }
  return findings;
}

/** Lines referencing accounts owned by another tenant. */
async function detectCrossTenantReferences(db, context) {
  const tenantId = context.businessId;
  const findings = [];
  const journals = await db.journalEntry.findMany({
    where: { tenantId, status: { in: [...POSTED_JOURNAL_STATUSES] } },
    include: { lines: true },
    take: 2000,
  });
  const accountIds = [...new Set(journals.flatMap((j) => j.lines.map((l) => l.accountId)))];
  if (accountIds.length === 0) return findings;
  const accounts = await db.account.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, tenantId: true },
  });
  const ownerOf = new Map(accounts.map((a) => [a.id, a.tenantId]));
  for (const je of journals) {
    for (const line of je.lines) {
      const owner = ownerOf.get(line.accountId);
      if (owner && owner !== tenantId) {
        findings.push({
          findingCode: 'P6-XTEN-001',
          anomalyType: 'CROSS_TENANT_REFERENCE',
          severity: AnomalySeverity.CRITICAL,
          confidence: ConfidenceLevel.CONFIRMED,
          journalEntryId: je.id,
          journalLineId: line.id,
          accountId: line.accountId,
          expectedCondition: 'Every journal line posts to an account owned by the journal business.',
          actualCondition: `line account belongs to tenant ${owner}`,
          detectionKey: `P6-XTEN-001:${line.id}`,
          metadata: { foreignTenantId: owner },
        });
      }
    }
  }
  return findings;
}

/** Posted journals with no accounting-period link (metadata repair candidates). */
async function detectMissingPeriodLinks(db, context) {
  const rows = await db.journalEntry.findMany({
    where: {
      tenantId: context.businessId,
      status: { in: [...POSTED_JOURNAL_STATUSES] },
      accountingPeriodId: null,
    },
    take: 2000,
  });
  return rows.map((je) => ({
    findingCode: 'P6-PER-001',
    anomalyType: 'TECHNICAL_LINKAGE_ERROR',
    severity: AnomalySeverity.MEDIUM,
    confidence: ConfidenceLevel.HIGH_CONFIDENCE, // period derivable from posting/entry date
    journalEntryId: je.id,
    expectedCondition: 'Posted journal carries its accounting-period link.',
    actualCondition: 'accountingPeriodId is null',
    detectionKey: `P6-PER-001:${je.id}`,
    metadata: { entryDate: je.entryDate, postingDate: je.postingDate },
  }));
}

/**
 * Run the full detection pass for one business and persist findings.
 *
 * @returns {Promise<{detected: number, byType: Record<string, number>, findings: object[]}>}
 */
export async function runAnomalyDetection(db, context, options = {}) {
  const startedAt = Date.now();

  const reconciliation = await runLedgerReconciliation(db, context, {
    compareStoredBalances: true,
    compareProjection: true,
    runJournalChecks: true,
  });

  const candidates = [
    ...reconciliation.findings.map(ruleFindingToAnomaly),
    ...(await detectDuplicateSourcePostings(db, context)),
    ...(await detectOrphanJournals(db, context)),
    ...(await detectOpeningDuplication(db, context)),
    ...(await detectCrossTenantReferences(db, context)),
    ...(await detectMissingPeriodLinks(db, context)),
  ];

  const persisted = [];
  for (const candidate of candidates) {
    persisted.push(await recordAnomaly(db, context, candidate));
  }

  const byType = {};
  const bySeverity = {};
  for (const a of persisted) {
    byType[a.anomalyType] = (byType[a.anomalyType] ?? 0) + 1;
    bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
  }

  logAccountingOperation({
    operation: 'repair.detection.completed',
    tenantId: context.businessId,
    detected: persisted.length,
    byType,
    durationMs: Date.now() - startedAt,
  });

  return {
    detected: persisted.length,
    byType,
    bySeverity,
    reconciliationStatus: reconciliation.status,
    durationMs: Date.now() - startedAt,
    findings: options.includeFindings ? persisted : undefined,
  };
}
