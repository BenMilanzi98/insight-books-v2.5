/**
 * Phase 6 — Historical accounting repair tests.
 *
 * Covers: the anomaly registry (idempotent detection, duplicate-finding
 * prevention, status machine, evidence, business scope), detection rules
 * (duplicate source postings, orphan journals, cross-tenant references,
 * opening duplication, missing period links), the repair command contract
 * (strict typing, metadata whitelist, financial-field refusal), the approval
 * workflow (confidence gates, separation of duties), dry-run purity (zero
 * writes), idempotent execution (replay, conflicting instructions, retry
 * after failure), the HISTORICAL_REPAIR posting path end-to-end (duplicate
 * reversal, salary reclassification), metadata repairs with rollback,
 * transaction rollback on mid-repair failure, batch lifecycle with snapshots
 * and verification, and multi-tenant security.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeAcctV2PrismaStub } from './helpers/acctV2PrismaStub.js';
import { createAccountingContext } from '../lib/accountingV2/domain/accountingContext.js';
import {
  recordAnomaly,
  addEvidence,
  transitionAnomaly,
  proposeRepair,
  decideRepair,
  markException,
  listAnomalies,
  getAnomaly,
} from '../lib/accountingV2/repair/anomalyRegistryService.js';
import { runAnomalyDetection } from '../lib/accountingV2/repair/anomalyDetectionService.js';
import {
  buildRepairCommand,
  dryRunRepair,
  executeRepair,
  rollbackMetadataRepair,
} from '../lib/accountingV2/repair/repairExecutionService.js';
import {
  createBatch,
  transitionBatch,
  captureSnapshot,
} from '../lib/accountingV2/repair/repairBatchService.js';
import { verifyBatch } from '../lib/accountingV2/repair/repairVerificationService.js';
import {
  AnomalyStatus,
  RepairType,
  ConfidenceLevel,
  ANOMALY_TYPES,
  RULE_TO_ANOMALY_TYPE,
  isRepairPermitted,
} from '../lib/accountingV2/repair/repairCatalogue.js';
import { AccountingValidationError, ApprovalInvalidError } from '../lib/accountingV2/domain/errors.js';
import { FLAG } from '../lib/accountingV2/infrastructure/featureFlags.js';

const T1 = 'tenant-1';
const T2 = 'tenant-2';
const INVESTIGATOR = 'user-investigator';
const APPROVER = 'user-approver';
const EXECUTOR = 'user-executor';
const allow = () => true;

const ctx = (userId = INVESTIGATOR, businessId = T1) =>
  createAccountingContext({ businessId, userId, sourceChannel: 'test' });

const D = (s) => new Date(s);

/** Chart + dual-ledger seed with a confirmed duplicate posting pair.
 * Legacy `Transaction` rows remain for Phase-6 detectors that still scan them.
 * Parallel `ACCOUNTING_V2` journals are the canonical ledger authority. */
const repairSeed = () => ({
  accounts: [
    { id: 'cash', tenantId: T1, accountCode: '1000', accountName: 'Cash', accountType: 'Asset', isActive: true },
    { id: 'rev', tenantId: T1, accountCode: '4000', accountName: 'Revenue', accountType: 'Income', coaV2Category: 'REVENUE', isActive: true },
    { id: 'exp-gen', tenantId: T1, accountCode: '5900', accountName: 'General Expenses', accountType: 'Expense', isActive: true },
    { id: 'sal-5200', tenantId: T1, accountCode: '5200', accountName: 'Salaries & Wages', accountType: 'Expense', isActive: true },
    { id: 'other-cash', tenantId: T2, accountCode: '1000', accountName: 'Other cash', accountType: 'Asset', isActive: true },
  ],
  legacyTransactions: [
    // Confirmed duplicate: one expense source posted twice with identical totals.
    { id: 'tx-dup-a', tenantId: T1, date: D('2026-03-05'), status: 'posted', isReversal: false, sourceType: 'expense', sourceId: 'EXP-77', description: 'Fuel expense', createdAt: D('2026-03-05') },
    { id: 'tx-dup-b', tenantId: T1, date: D('2026-03-05'), status: 'posted', isReversal: false, sourceType: 'expense', sourceId: 'EXP-77', description: 'Fuel expense (dup)', createdAt: D('2026-03-05') },
    // Legitimate single posting.
    { id: 'tx-ok', tenantId: T1, date: D('2026-03-10'), status: 'posted', isReversal: false, sourceType: 'sale', sourceId: 'S-1', description: 'Sale', createdAt: D('2026-03-10') },
    // Salary wrongly posted to General Expenses.
    { id: 'tx-sal', tenantId: T1, date: D('2026-04-28'), status: 'posted', isReversal: false, sourceType: 'payroll', sourceId: 'PR-4', description: 'April salaries', createdAt: D('2026-04-28') },
  ],
  transactionLines: [
    { id: 'da1', transactionId: 'tx-dup-a', lineNumber: 1, accountId: 'exp-gen', debitAmount: 80, creditAmount: 0 },
    { id: 'da2', transactionId: 'tx-dup-a', lineNumber: 2, accountId: 'cash', debitAmount: 0, creditAmount: 80 },
    { id: 'db1', transactionId: 'tx-dup-b', lineNumber: 1, accountId: 'exp-gen', debitAmount: 80, creditAmount: 0 },
    { id: 'db2', transactionId: 'tx-dup-b', lineNumber: 2, accountId: 'cash', debitAmount: 0, creditAmount: 80 },
    { id: 'ok1', transactionId: 'tx-ok', lineNumber: 1, accountId: 'cash', debitAmount: 200, creditAmount: 0 },
    { id: 'ok2', transactionId: 'tx-ok', lineNumber: 2, accountId: 'rev', debitAmount: 0, creditAmount: 200 },
    { id: 'sl1', transactionId: 'tx-sal', lineNumber: 1, accountId: 'exp-gen', debitAmount: 500, creditAmount: 0 },
    { id: 'sl2', transactionId: 'tx-sal', lineNumber: 2, accountId: 'cash', debitAmount: 0, creditAmount: 500 },
  ],
  legacyJournalEntries: [
    // Canonical V2 mirrors of the operational postings (ledger authority).
    { id: 'je-dup-a', tenantId: T1, transactionId: null, status: 'Posted', entryType: 'Regular', entryDate: D('2026-03-05'), postingDate: D('2026-03-05'), sourceType: 'expense', sourceId: 'EXP-77', description: 'Fuel expense', createdAt: D('2026-03-05'), architectureVersion: 'ACCOUNTING_V2' },
    { id: 'je-dup-b', tenantId: T1, transactionId: null, status: 'Posted', entryType: 'Regular', entryDate: D('2026-03-05'), postingDate: D('2026-03-05'), sourceType: 'expense', sourceId: 'EXP-77', description: 'Fuel expense (dup)', createdAt: D('2026-03-05'), architectureVersion: 'ACCOUNTING_V2' },
    { id: 'je-ok', tenantId: T1, transactionId: null, status: 'Posted', entryType: 'Regular', entryDate: D('2026-03-10'), postingDate: D('2026-03-10'), sourceType: 'sale', sourceId: 'S-1', description: 'Sale', createdAt: D('2026-03-10'), architectureVersion: 'ACCOUNTING_V2' },
    { id: 'je-sal', tenantId: T1, transactionId: null, status: 'Posted', entryType: 'Regular', entryDate: D('2026-04-28'), postingDate: D('2026-04-28'), sourceType: 'payroll', sourceId: 'PR-4', description: 'April salaries', createdAt: D('2026-04-28'), architectureVersion: 'ACCOUNTING_V2' },
    // Orphan legacy journal: posted, no source, no sourceless classification (detection only; not V2 authority).
    { id: 'je-orphan', tenantId: T1, transactionId: null, status: 'Posted', entryType: 'Regular', entryDate: D('2026-02-14'), sourceType: null, sourceId: null, description: 'Unknown origin', createdAt: D('2026-02-14'), architectureVersion: 'LEGACY_V1' },
  ],
  journalEntryLines: [
    { id: 'jda1', journalEntryId: 'je-dup-a', lineNumber: 1, accountId: 'exp-gen', debitAmount: 80, creditAmount: 0 },
    { id: 'jda2', journalEntryId: 'je-dup-a', lineNumber: 2, accountId: 'cash', debitAmount: 0, creditAmount: 80 },
    { id: 'jdb1', journalEntryId: 'je-dup-b', lineNumber: 1, accountId: 'exp-gen', debitAmount: 80, creditAmount: 0 },
    { id: 'jdb2', journalEntryId: 'je-dup-b', lineNumber: 2, accountId: 'cash', debitAmount: 0, creditAmount: 80 },
    { id: 'jok1', journalEntryId: 'je-ok', lineNumber: 1, accountId: 'cash', debitAmount: 200, creditAmount: 0 },
    { id: 'jok2', journalEntryId: 'je-ok', lineNumber: 2, accountId: 'rev', debitAmount: 0, creditAmount: 200 },
    { id: 'jsl1', journalEntryId: 'je-sal', lineNumber: 1, accountId: 'exp-gen', debitAmount: 500, creditAmount: 0 },
    { id: 'jsl2', journalEntryId: 'je-sal', lineNumber: 2, accountId: 'cash', debitAmount: 0, creditAmount: 500 },
    { id: 'or1', journalEntryId: 'je-orphan', lineNumber: 1, accountId: 'exp-gen', debitAmount: 30, creditAmount: 0 },
    { id: 'or2', journalEntryId: 'je-orphan', lineNumber: 2, accountId: 'cash', debitAmount: 0, creditAmount: 30 },
  ],
  configurations: [
    { id: 'cfg1', tenantId: T1, baseCurrency: 'MWK', defaultPostingMode: 'NEW_ENGINE', enableShadowAccounting: false },
  ],
  featureFlags: [
    { id: 'f1', tenantId: T1, flagKey: FLAG.V2_ENABLED, moduleKey: '*', eventType: '*', enabled: true },
  ],
});

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

/** Drive an anomaly through investigation → proposal → approval. */
async function approvedAnomaly(client, { anomalyType, detectionKey, repairType, repairData, confidence }) {
  const anomaly = await recordAnomaly(client, ctx(INVESTIGATOR), {
    findingCode: 'TEST-001',
    anomalyType,
    detectionKey,
    confidence: confidence ?? ConfidenceLevel.CONFIRMED,
    expectedCondition: 'expected',
    actualCondition: 'actual',
  });
  await proposeRepair(client, ctx(INVESTIGATOR), anomaly.id, {
    repairType,
    reason: 'Documented test repair reason',
    repairData,
  });
  await decideRepair(client, ctx(APPROVER), anomaly.id, { approve: true });
  return getAnomaly(client, ctx(INVESTIGATOR), anomaly.id);
}

/** Create an approved batch (requester ≠ approver, backup reference present). */
async function approvedBatch(client, category = 'TEST') {
  const batch = await createBatch(client, ctx(INVESTIGATOR), {
    repairCategory: category,
    description: 'Test repair batch',
    backupReference: 'BACKUP_AND_RESTORE_VALIDATION.md#dev',
    rollbackPlan: 'Reverse repair journals / restore metadata previous values.',
  });
  await transitionBatch(client, ctx(INVESTIGATOR), batch.id, 'ANALYZED');
  await transitionBatch(client, ctx(INVESTIGATOR), batch.id, 'READY_FOR_REVIEW');
  await transitionBatch(client, ctx(APPROVER), batch.id, 'APPROVED');
  await transitionBatch(client, ctx(EXECUTOR), batch.id, 'EXECUTING');
  return batch;
}

/* ── 58.1 Anomaly registry ───────────────────────────────────────────────── */

describe('anomaly registry', () => {
  it('records anomalies idempotently — re-detection never duplicates findings', async () => {
    const { client, data } = makeAcctV2PrismaStub(repairSeed());
    const input = {
      findingCode: 'JRN-102',
      anomalyType: 'UNBALANCED_JOURNAL',
      detectionKey: 'JRN-102:je-x',
      financialImpactMinor: 500n,
    };
    const first = await recordAnomaly(client, ctx(), input);
    const second = await recordAnomaly(client, ctx(), { ...input, financialImpactMinor: 700n });
    expect(second.id).toBe(first.id);
    expect(data.anomalies).toHaveLength(1);
    expect(second.financialImpactMinor).toBe(700n); // measurements refresh
    expect(second.status).toBe(AnomalyStatus.DETECTED); // workflow never regresses
  });

  it('rejects unknown anomaly types and missing detection keys', async () => {
    const { client } = makeAcctV2PrismaStub(repairSeed());
    await expect(
      recordAnomaly(client, ctx(), { findingCode: 'X', anomalyType: 'NOT_A_TYPE', detectionKey: 'k' })
    ).rejects.toThrow(AccountingValidationError);
    await expect(
      recordAnomaly(client, ctx(), { findingCode: 'X', anomalyType: 'DUPLICATE_JOURNAL' })
    ).rejects.toThrow(AccountingValidationError);
  });

  it('enforces the status machine — VERIFIED is unreachable without repair + verification', async () => {
    const { client } = makeAcctV2PrismaStub(repairSeed());
    const anomaly = await recordAnomaly(client, ctx(), {
      findingCode: 'T',
      anomalyType: 'DUPLICATE_JOURNAL',
      detectionKey: 'k1',
    });
    await expect(
      transitionAnomaly(client, ctx(), anomaly.id, AnomalyStatus.VERIFIED)
    ).rejects.toThrow(/cannot move/);
    await expect(
      transitionAnomaly(client, ctx(), anomaly.id, AnomalyStatus.REPAIRED)
    ).rejects.toThrow(/cannot move/);
  });

  it('appends evidence and scopes all reads to the business', async () => {
    const { client } = makeAcctV2PrismaStub(repairSeed());
    const anomaly = await recordAnomaly(client, ctx(), {
      findingCode: 'T',
      anomalyType: 'MISSING_SOURCE_LINK',
      detectionKey: 'k2',
    });
    const evidence = await addEvidence(client, ctx(), anomaly.id, {
      evidenceType: 'REFERENCE_MATCH',
      description: 'Invoice number matches journal reference exactly.',
      strength: ConfidenceLevel.CONFIRMED,
    });
    expect(evidence.anomalyId).toBe(anomaly.id);
    // Cross-business access is refused.
    await expect(getAnomaly(client, ctx(INVESTIGATOR, T2), anomaly.id)).rejects.toThrow(/not found/);
    const other = await listAnomalies(client, ctx(INVESTIGATOR, T2));
    expect(other.anomalies).toHaveLength(0);
  });

  it('records accepted exceptions and keeps them visible', async () => {
    const { client, data } = makeAcctV2PrismaStub(repairSeed());
    const anomaly = await recordAnomaly(client, ctx(), {
      findingCode: 'T',
      anomalyType: 'UNSUPPORTED_LIABILITY',
      detectionKey: 'k3',
      confidence: ConfidenceLevel.UNSUPPORTED,
    });
    const exception = await markException(client, ctx(APPROVER), anomaly.id, {
      evidenceGap: 'No creditor contract or statement available.',
      reasonBlocked: 'Unsupported balance must not be repaired by inventing a journal.',
      disclosureRequired: true,
    });
    expect(exception.status).toBe('OPEN');
    expect(data.anomalies[0].status).toBe(AnomalyStatus.ACCEPTED_EXCEPTION);
    expect(data.repairExceptions).toHaveLength(1);
  });
});

/* ── Detection rules ─────────────────────────────────────────────────────── */

describe('anomaly detection', () => {
  it('detects duplicate source postings, orphan journals and is idempotent across runs', async () => {
    const { client, data } = makeAcctV2PrismaStub(repairSeed());
    const first = await runAnomalyDetection(client, ctx());
    expect(first.byType.DUPLICATE_JOURNAL).toBe(1);
    expect(first.byType.ORPHAN_JOURNAL).toBe(1);
    const dup = data.anomalies.find((a) => a.anomalyType === 'DUPLICATE_JOURNAL');
    expect(dup.detectionKey).toBe('P6-DUP-001:expense:EXP-77');
    expect(dup.confidence).toBe(ConfidenceLevel.HIGH_CONFIDENCE); // identical totals
    expect(dup.metadata.transactionIds).toEqual(['tx-dup-a', 'tx-dup-b']);

    const countAfterFirst = data.anomalies.length;
    await runAnomalyDetection(client, ctx());
    expect(data.anomalies.length).toBe(countAfterFirst); // no duplicated findings
  });

  it('does not flag a legitimate single posting as duplicate', async () => {
    const { client, data } = makeAcctV2PrismaStub(repairSeed());
    await runAnomalyDetection(client, ctx());
    expect(
      data.anomalies.some((a) => a.anomalyType === 'DUPLICATE_JOURNAL' && a.detectionKey.includes('S-1'))
    ).toBe(false);
  });

  it('detects cross-tenant account references as CONFIRMED critical findings', async () => {
    const seed = repairSeed();
    seed.legacyJournalEntries.push({
      id: 'je-xten', tenantId: T1, transactionId: null, status: 'Posted', entryType: 'Adjustment',
      entryDate: D('2026-05-01'), createdAt: D('2026-05-01'), architectureVersion: 'LEGACY_V1',
    });
    seed.journalEntryLines.push(
      { id: 'xt1', journalEntryId: 'je-xten', lineNumber: 1, accountId: 'other-cash', debitAmount: 10, creditAmount: 0 },
      { id: 'xt2', journalEntryId: 'je-xten', lineNumber: 2, accountId: 'cash', debitAmount: 0, creditAmount: 10 }
    );
    const { client, data } = makeAcctV2PrismaStub(seed);
    await runAnomalyDetection(client, ctx());
    const finding = data.anomalies.find((a) => a.anomalyType === 'CROSS_TENANT_REFERENCE');
    expect(finding).toBeTruthy();
    expect(finding.severity).toBe('CRITICAL');
    expect(finding.confidence).toBe(ConfidenceLevel.CONFIRMED);
    expect(finding.journalLineId).toBe('xt1');
  });

  it('detects multiple opening postings touching one account', async () => {
    const seed = repairSeed();
    seed.legacyTransactions.push(
      { id: 'tx-ob1', tenantId: T1, date: D('2025-01-01'), status: 'posted', isReversal: false, sourceType: 'onboarding', sourceId: 'OB-1', createdAt: D('2025-01-01') },
      { id: 'tx-ob2', tenantId: T1, date: D('2025-01-02'), status: 'posted', isReversal: false, sourceType: 'opening_balance', sourceId: 'OB-2', createdAt: D('2025-01-02') }
    );
    seed.transactionLines.push(
      { id: 'ob1a', transactionId: 'tx-ob1', lineNumber: 1, accountId: 'cash', debitAmount: 1000, creditAmount: 0 },
      { id: 'ob2a', transactionId: 'tx-ob2', lineNumber: 1, accountId: 'cash', debitAmount: 1000, creditAmount: 0 }
    );
    const { client, data } = makeAcctV2PrismaStub(seed);
    await runAnomalyDetection(client, ctx());
    const finding = data.anomalies.find((a) => a.anomalyType === 'OPENING_BALANCE_DUPLICATION');
    expect(finding).toBeTruthy();
    expect(finding.accountId).toBe('cash');
    // Authoritative batch selection is a review decision, never automatic.
    expect(finding.confidence).toBe(ConfidenceLevel.MEDIUM_CONFIDENCE);
  });

  it('maps every integrity rule code to a catalogued anomaly type', () => {
    for (const anomalyType of Object.values(RULE_TO_ANOMALY_TYPE)) {
      expect(ANOMALY_TYPES[anomalyType]).toBeTruthy();
    }
  });
});

/* ── 43 Repair command contract ──────────────────────────────────────────── */

describe('repair command contract', () => {
  const base = {
    repairBatchId: 'b1',
    anomalyId: 'a1',
    businessId: T1,
    repairType: RepairType.METADATA_ONLY_REPAIR,
    reason: 'test',
  };

  it('rejects financial fields in metadata changes (mass assignment blocked)', () => {
    expect(() =>
      buildRepairCommand({
        ...base,
        metadataChanges: { targetType: 'JournalEntry', targetId: 'je1', changes: { debitAmount: 999 } },
      })
    ).toThrow(/not metadata-repairable/);
    expect(() =>
      buildRepairCommand({
        ...base,
        metadataChanges: { targetType: 'JournalEntry', targetId: 'je1', changes: { status: 'Draft' } },
      })
    ).toThrow(/not metadata-repairable/);
    expect(() =>
      buildRepairCommand({
        ...base,
        metadataChanges: { targetType: 'Account', targetId: 'x', changes: { balance: 0 } },
      })
    ).toThrow(/unsupported target/);
  });

  it('requires a proposed journal for journal-creating repairs and balance-positive lines', () => {
    expect(() =>
      buildRepairCommand({ ...base, repairType: RepairType.DUPLICATE_EFFECT_REPAIR })
    ).toThrow(/requires a proposed journal/);
    expect(() =>
      buildRepairCommand({
        ...base,
        repairType: RepairType.RECLASSIFICATION_REPAIR,
        proposedJournal: { lines: [{ accountId: 'a', debit: 10, credit: 5 }, { accountId: 'b', credit: 5 }] },
      })
    ).toThrow(/exactly one of debit or credit/);
  });

  it('produces a stable hash: same instructions → same hash, changed → different', () => {
    const cmd = {
      ...base,
      repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
      proposedJournal: { lines: [{ accountId: 'a', debit: 10 }, { accountId: 'b', credit: 10 }] },
    };
    const one = buildRepairCommand(cmd);
    const two = buildRepairCommand(cmd);
    expect(one.commandHash).toBe(two.commandHash);
    const three = buildRepairCommand({
      ...cmd,
      proposedJournal: { lines: [{ accountId: 'a', debit: 11 }, { accountId: 'b', credit: 11 }] },
    });
    expect(three.commandHash).not.toBe(one.commandHash);
  });
});

/* ── 10/11 Evidence, confidence and approval workflow ─────────────────────── */

describe('approval workflow', () => {
  it('refuses approval below HIGH_CONFIDENCE evidence', async () => {
    const { client } = makeAcctV2PrismaStub(repairSeed());
    const anomaly = await recordAnomaly(client, ctx(), {
      findingCode: 'T',
      anomalyType: 'DUPLICATE_JOURNAL',
      detectionKey: 'k-low',
      confidence: ConfidenceLevel.LOW_CONFIDENCE,
    });
    await proposeRepair(client, ctx(INVESTIGATOR), anomaly.id, {
      repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
      reason: 'similar amounts only',
    });
    await expect(
      decideRepair(client, ctx(APPROVER), anomaly.id, { approve: true })
    ).rejects.toThrow(/does not permit repair approval/);
  });

  it('refuses repair classes not permitted for the anomaly type', async () => {
    const { client } = makeAcctV2PrismaStub(repairSeed());
    const anomaly = await recordAnomaly(client, ctx(), {
      findingCode: 'T',
      anomalyType: 'REPORT_QUERY_ERROR',
      detectionKey: 'k-report',
    });
    await expect(
      proposeRepair(client, ctx(), anomaly.id, {
        repairType: RepairType.MISSING_JOURNAL_REPAIR,
        reason: 'wrong class',
      })
    ).rejects.toThrow(/not permitted/);
    expect(isRepairPermitted('REPORT_QUERY_ERROR', RepairType.REPORT_ONLY_REPAIR)).toBe(true);
  });

  it('enforces separation of duties: the approver cannot execute a high-risk repair', async () => {
    const { client } = makeAcctV2PrismaStub(repairSeed());
    const anomaly = await approvedAnomaly(client, {
      anomalyType: 'DUPLICATE_JOURNAL',
      detectionKey: 'k-sod',
      repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
      repairData: {
        lines: [{ accountId: 'cash', debit: '80.00' }, { accountId: 'exp-gen', credit: '80.00' }],
        transactionDate: '2026-03-05',
      },
    });
    const batch = await approvedBatch(client);
    await expect(
      executeRepair(
        client,
        ctx(APPROVER), // approver tries to execute their own approval
        {
          repairBatchId: batch.id,
          anomalyId: anomaly.id,
          repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
          reason: 'reverse duplicate',
          proposedJournal: { lines: anomaly.proposedRepairData.lines },
        },
        { hasPermission: allow }
      )
    ).rejects.toThrow(ApprovalInvalidError);
  });

  it('requires a validated backup reference before batch approval', async () => {
    const { client } = makeAcctV2PrismaStub(repairSeed());
    const batch = await createBatch(client, ctx(INVESTIGATOR), {
      repairCategory: 'TEST',
      description: 'No backup',
    });
    await transitionBatch(client, ctx(INVESTIGATOR), batch.id, 'ANALYZED');
    await transitionBatch(client, ctx(INVESTIGATOR), batch.id, 'READY_FOR_REVIEW');
    await expect(
      transitionBatch(client, ctx(APPROVER), batch.id, 'APPROVED')
    ).rejects.toThrow(/backup reference/);
  });

  it('blocks the requester approving their own batch', async () => {
    const { client } = makeAcctV2PrismaStub(repairSeed());
    const batch = await createBatch(client, ctx(INVESTIGATOR), {
      repairCategory: 'TEST',
      description: 'Self approval attempt',
      backupReference: 'backup#1',
    });
    await transitionBatch(client, ctx(INVESTIGATOR), batch.id, 'ANALYZED');
    await transitionBatch(client, ctx(INVESTIGATOR), batch.id, 'READY_FOR_REVIEW');
    await expect(
      transitionBatch(client, ctx(INVESTIGATOR), batch.id, 'APPROVED')
    ).rejects.toThrow(ApprovalInvalidError);
  });
});

/* ── 58.3 Dry run ────────────────────────────────────────────────────────── */

describe('dry-run engine', () => {
  it('produces a complete preview and writes absolutely nothing', async () => {
    const { client, data } = makeAcctV2PrismaStub(repairSeed());
    const anomaly = await approvedAnomaly(client, {
      anomalyType: 'DUPLICATE_JOURNAL',
      detectionKey: 'k-dry',
      repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
      repairData: {
        lines: [{ accountId: 'cash', debit: '80.00' }, { accountId: 'exp-gen', credit: '80.00' }],
      },
    });
    const batch = await createBatch(client, ctx(INVESTIGATOR), {
      repairCategory: 'DUP',
      description: 'dry run batch',
      backupReference: 'backup#1',
    });
    const before = JSON.stringify({
      journals: data.legacyJournalEntries.length,
      tx: data.legacyTransactions.length,
      actions: data.repairActions.length,
      registry: data.eventRegistry.length,
    });
    const preview = await dryRunRepair(client, ctx(EXECUTOR), {
      repairBatchId: batch.id,
      anomalyId: anomaly.id,
      repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
      reason: 'reverse duplicate',
      proposedJournal: { lines: anomaly.proposedRepairData.lines },
    });
    expect(preview.dryRun).toBe(true);
    expect(preview.wouldExecute).toBe(true);
    expect(preview.expectedJournal.totalDebitMinor).toBe(8000);
    expect(preview.expectedJournal.totalCreditMinor).toBe(8000);
    expect(preview.approvalRequirement.separationOfDuties).toBe(true);
    expect(preview.rollbackPlan).toMatch(/reversal of the repair journal/i);
    const after = JSON.stringify({
      journals: data.legacyJournalEntries.length,
      tx: data.legacyTransactions.length,
      actions: data.repairActions.length,
      registry: data.eventRegistry.length,
    });
    expect(after).toBe(before); // zero writes
  });

  it('reports unbalanced proposals as blockers', async () => {
    const { client } = makeAcctV2PrismaStub(repairSeed());
    const anomaly = await approvedAnomaly(client, {
      anomalyType: 'DUPLICATE_JOURNAL',
      detectionKey: 'k-dry2',
      repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
      repairData: { lines: [{ accountId: 'cash', debit: '80.00' }, { accountId: 'exp-gen', credit: '70.00' }] },
    });
    const batch = await createBatch(client, ctx(), {
      repairCategory: 'DUP',
      description: 'x',
      backupReference: 'b',
    });
    const preview = await dryRunRepair(client, ctx(EXECUTOR), {
      repairBatchId: batch.id,
      anomalyId: anomaly.id,
      repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
      reason: 'r',
      proposedJournal: { lines: anomaly.proposedRepairData.lines },
    });
    expect(preview.wouldExecute).toBe(false);
    expect(preview.blockers.some((b) => /unbalanced/i.test(b))).toBe(true);
  });
});

/* ── 58.5 + 16 Duplicate repair end-to-end through the posting engine ────── */

describe('duplicate-journal repair (HISTORICAL_REPAIR posting path)', () => {
  async function runDuplicateRepair(client) {
    const anomaly = await approvedAnomaly(client, {
      anomalyType: 'DUPLICATE_JOURNAL',
      detectionKey: 'k-dup-e2e',
      repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
      repairData: {
        // Reversal of the duplicate tx-dup-b: swap each line.
        lines: [
          { accountId: 'cash', debit: '80.00', description: 'Reverse duplicate EXP-77 (cash)' },
          { accountId: 'exp-gen', credit: '80.00', description: 'Reverse duplicate EXP-77 (expense)' },
        ],
        transactionDate: '2026-03-05',
      },
    });
    const batch = await approvedBatch(client, 'DUPLICATE_JOURNAL');
    const result = await executeRepair(
      client,
      ctx(EXECUTOR),
      {
        repairBatchId: batch.id,
        anomalyId: anomaly.id,
        repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
        reason: 'Reverse confirmed duplicate of expense EXP-77',
        proposedJournal: { lines: anomaly.proposedRepairData.lines },
        postingDate: '2026-03-05',
      },
      { hasPermission: allow }
    );
    return { anomaly, batch, result };
  }

  it('creates one balanced HREP repair journal, preserves both originals, nets the effect', async () => {
    const { client, data } = makeAcctV2PrismaStub(repairSeed());
    const { anomaly, result } = await runDuplicateRepair(client);
    expect(result.wasExistingRepair).toBe(false);

    // The repair journal exists, is V2, balanced, HREP-numbered, correctly typed.
    const repairJournal = data.legacyJournalEntries.find((j) => j.entryType === 'HistoricalRepair');
    expect(repairJournal).toBeTruthy();
    expect(repairJournal.journalNumber).toMatch(/^HREP-/);
    expect(repairJournal.architectureVersion).toBe('ACCOUNTING_V2');
    expect(repairJournal.sourceType).toBe('AcctV2RepairAction');

    // Both original duplicates are preserved — nothing deleted.
    expect(data.legacyTransactions.find((t) => t.id === 'tx-dup-a')).toBeTruthy();
    expect(data.legacyTransactions.find((t) => t.id === 'tx-dup-b')).toBeTruthy();

    // Action + anomaly stamped atomically with the posting.
    const action = data.repairActions[0];
    expect(action.status).toBe('COMPLETED');
    expect(action.journalEntryIds).toEqual([repairJournal.id]);
    expect(data.anomalies.find((a) => a.id === anomaly.id).status).toBe(AnomalyStatus.REPAIRED);

    // Net ledger effect (V2 authority only — orphan LEGACY_V1 excluded):
    // exp-gen debits 80+80+500(sal)=660, credit 80 → net 580. Duplicate cancelled.
    const { getCanonicalAccountTotals } = await import('../lib/accountingV2/ledger/canonicalJournalSource.js');
    const totals = await getCanonicalAccountTotals(client, ctx());
    const expGen = totals.get('exp-gen');
    expect(expGen.debitMinor - expGen.creditMinor).toBe(58000);
  });

  it('replays idempotently — a second execution creates no second reversal', async () => {
    const { client, data } = makeAcctV2PrismaStub(repairSeed());
    const { anomaly, batch } = await runDuplicateRepair(client);
    const journalsAfterFirst = data.legacyJournalEntries.length;
    const replay = await executeRepair(
      client,
      ctx(EXECUTOR),
      {
        repairBatchId: batch.id,
        anomalyId: anomaly.id,
        repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
        reason: 'Reverse confirmed duplicate of expense EXP-77',
        proposedJournal: { lines: anomaly.proposedRepairData.lines },
        postingDate: '2026-03-05',
      },
      { hasPermission: allow }
    );
    expect(replay.wasExistingRepair).toBe(true);
    expect(data.legacyJournalEntries.length).toBe(journalsAfterFirst);
    expect(data.repairActions).toHaveLength(1);
  });

  it('rejects changed instructions under the same repair identity', async () => {
    const { client } = makeAcctV2PrismaStub(repairSeed());
    const { anomaly, batch } = await runDuplicateRepair(client);
    await expect(
      executeRepair(
        client,
        ctx(EXECUTOR),
        {
          repairBatchId: batch.id,
          anomalyId: anomaly.id,
          repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
          reason: 'different amounts this time',
          proposedJournal: {
            lines: [{ accountId: 'cash', debit: '99.00' }, { accountId: 'exp-gen', credit: '99.00' }],
          },
        },
        { hasPermission: allow }
      )
    ).rejects.toThrow(/DIFFERENT instructions/);
  });

  it('refuses to post a proposal that differs from the approved proposal', async () => {
    const { client } = makeAcctV2PrismaStub(repairSeed());
    const anomaly = await approvedAnomaly(client, {
      anomalyType: 'DUPLICATE_JOURNAL',
      detectionKey: 'k-tamper',
      repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
      repairData: { lines: [{ accountId: 'cash', debit: '80.00' }, { accountId: 'exp-gen', credit: '80.00' }] },
    });
    const batch = await approvedBatch(client);
    await expect(
      executeRepair(
        client,
        ctx(EXECUTOR),
        {
          repairBatchId: batch.id,
          anomalyId: anomaly.id,
          repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
          reason: 'tampered',
          repairVersion: 2, // fresh identity, tampered lines
          proposedJournal: {
            lines: [{ accountId: 'cash', debit: '8000.00' }, { accountId: 'exp-gen', credit: '8000.00' }],
          },
        },
        { hasPermission: allow }
      )
    ).rejects.toThrow(/differs from the approved repair proposal/);
  });
});

/* ── 58.7 + 22 Salary reclassification ───────────────────────────────────── */

describe('salary reclassification to Account 5200', () => {
  it('moves the classification without changing total expense; original journal untouched', async () => {
    const { client, data } = makeAcctV2PrismaStub(repairSeed());
    const anomaly = await approvedAnomaly(client, {
      anomalyType: 'WRONG_ACCOUNT',
      detectionKey: 'k-sal',
      repairType: RepairType.RECLASSIFICATION_REPAIR,
      repairData: {
        lines: [
          { accountId: 'sal-5200', debit: '500.00', description: 'Reclass April salaries to 5200' },
          { accountId: 'exp-gen', credit: '500.00', description: 'Reclass out of General Expenses' },
        ],
        transactionDate: '2026-04-28',
      },
    });
    const batch = await approvedBatch(client, 'SALARY_RECLASS');
    const originalLines = JSON.stringify(data.transactionLines.filter((l) => l.transactionId === 'tx-sal'));
    await executeRepair(
      client,
      ctx(EXECUTOR),
      {
        repairBatchId: batch.id,
        anomalyId: anomaly.id,
        repairType: RepairType.RECLASSIFICATION_REPAIR,
        reason: 'Salary expense posted to General Expenses instead of 5200',
        proposedJournal: { lines: anomaly.proposedRepairData.lines },
        postingDate: '2026-04-28',
      },
      { hasPermission: allow }
    );
    // Original posting is untouched.
    expect(JSON.stringify(data.transactionLines.filter((l) => l.transactionId === 'tx-sal'))).toBe(originalLines);
    // Classification moved; total expense unchanged.
    const { getCanonicalAccountTotals } = await import('../lib/accountingV2/ledger/canonicalJournalSource.js');
    const totals = await getCanonicalAccountTotals(client, ctx());
    const sal = totals.get('sal-5200');
    const gen = totals.get('exp-gen');
    expect(sal.debitMinor - sal.creditMinor).toBe(50000); // 500 now in 5200
    // exp-gen (V2): 80+80+500 debits − 500 reclass credit = 160 net (orphan LEGACY_V1 excluded)
    expect(gen.debitMinor - gen.creditMinor).toBe(16000);
    // Total expense across both accounts unchanged: 660.
    expect(sal.debitMinor - sal.creditMinor + gen.debitMinor - gen.creditMinor).toBe(66000);
  });
});

/* ── 58.4 + 15 Metadata repairs and rollback ─────────────────────────────── */

describe('metadata repairs', () => {
  async function metadataRepair(client, changes, anomalyKey = 'k-meta') {
    const anomaly = await approvedAnomaly(client, {
      anomalyType: 'MISSING_SOURCE_LINK',
      detectionKey: anomalyKey,
      repairType: RepairType.SOURCE_LINK_REPAIR,
      repairData: { note: 'link proven by exact reference + amount + date' },
    });
    const batch = await approvedBatch(client, 'METADATA');
    const result = await executeRepair(
      client,
      ctx(EXECUTOR),
      {
        repairBatchId: batch.id,
        anomalyId: anomaly.id,
        repairType: RepairType.SOURCE_LINK_REPAIR,
        reason: 'Proven source link (unique reference match)',
        metadataChanges: changes,
      },
      { hasPermission: allow }
    );
    return { anomaly, batch, result };
  }

  it('applies whitelisted changes, preserves previous values, and rolls back exactly', async () => {
    const { client, data } = makeAcctV2PrismaStub(repairSeed());
    const { result } = await metadataRepair(client, {
      targetType: 'JournalEntry',
      targetId: 'je-orphan',
      changes: { sourceType: 'expense', sourceId: 'EXP-12' },
    });
    const journal = data.legacyJournalEntries.find((j) => j.id === 'je-orphan');
    expect(journal.sourceType).toBe('expense');
    expect(journal.sourceId).toBe('EXP-12');
    expect(result.action.previousValues).toEqual({ sourceType: null, sourceId: null });

    // Rollback restores the exact previous values.
    const rolledBack = await rollbackMetadataRepair(client, ctx(APPROVER), result.action.id);
    expect(rolledBack.status).toBe('ROLLED_BACK');
    const restored = data.legacyJournalEntries.find((j) => j.id === 'je-orphan');
    expect(restored.sourceType).toBeNull();
    expect(restored.sourceId).toBeNull();
  });

  it('refuses cross-business metadata targets', async () => {
    const seed = repairSeed();
    seed.legacyJournalEntries.push({
      id: 'je-foreign', tenantId: T2, transactionId: null, status: 'Posted', entryType: 'Regular',
      entryDate: D('2026-01-01'), createdAt: D('2026-01-01'),
    });
    const { client } = makeAcctV2PrismaStub(seed);
    await expect(
      metadataRepair(client, {
        targetType: 'JournalEntry',
        targetId: 'je-foreign',
        changes: { sourceType: 'expense' },
      })
    ).rejects.toThrow(/another business/);
  });
});

/* ── 58.13 Transaction rollback ──────────────────────────────────────────── */

describe('repair failure atomicity', () => {
  it('leaves no partial repair when journal persistence fails mid-transaction', async () => {
    const { client, data, state } = makeAcctV2PrismaStub(repairSeed());
    const anomaly = await approvedAnomaly(client, {
      anomalyType: 'DUPLICATE_JOURNAL',
      detectionKey: 'k-fail',
      repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
      repairData: {
        lines: [{ accountId: 'cash', debit: '80.00' }, { accountId: 'exp-gen', credit: '80.00' }],
        transactionDate: '2026-03-05',
      },
    });
    const batch = await approvedBatch(client);
    state.failOn = 'journalEntry.create';
    const input = {
      repairBatchId: batch.id,
      anomalyId: anomaly.id,
      repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
      reason: 'Reverse duplicate',
      proposedJournal: { lines: anomaly.proposedRepairData.lines },
      postingDate: '2026-03-05',
    };
    // The engine sanitizes infrastructure errors: no partial posting is kept.
    await expect(executeRepair(client, ctx(EXECUTOR), input, { hasPermission: allow })).rejects.toThrow(
      /No partial posting was kept/
    );
    // No repair journal; anomaly NOT marked repaired; failed attempt preserved.
    expect(data.legacyJournalEntries.some((j) => j.entryType === 'HistoricalRepair')).toBe(false);
    expect(data.anomalies.find((a) => a.id === anomaly.id).status).not.toBe(AnomalyStatus.REPAIRED);
    const action = data.repairActions.find((a) => a.anomalyId === anomaly.id);
    expect(action.status).toBe('FAILED');
    expect(action.errorMessage).toMatch(/No partial posting was kept/);

    // Retry after the temporary failure succeeds and completes the SAME action.
    const retry = await executeRepair(client, ctx(EXECUTOR), input, { hasPermission: allow });
    expect(retry.action.id).toBe(action.id);
    expect(data.repairActions.filter((a) => a.anomalyId === anomaly.id)).toHaveLength(1);
    expect(data.legacyJournalEntries.filter((j) => j.entryType === 'HistoricalRepair')).toHaveLength(1);
    expect(data.anomalies.find((a) => a.id === anomaly.id).status).toBe(AnomalyStatus.REPAIRED);
  });
});

/* ── 47/48/49 Snapshots, verification, ledger agreement ──────────────────── */

describe('batch snapshots and verification', () => {
  it('captures before/after snapshots and verifies a balanced batch; anomalies reach VERIFIED', async () => {
    const { client, data } = makeAcctV2PrismaStub(repairSeed());
    const anomaly = await approvedAnomaly(client, {
      anomalyType: 'DUPLICATE_JOURNAL',
      detectionKey: 'k-verify',
      repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
      repairData: {
        lines: [{ accountId: 'cash', debit: '80.00' }, { accountId: 'exp-gen', credit: '80.00' }],
        transactionDate: '2026-03-05',
      },
    });
    const batch = await approvedBatch(client, 'DUP');
    const before = await captureSnapshot(client, ctx(EXECUTOR), batch.id, 'BEFORE');
    expect(before.checksum).toBeTruthy();

    await executeRepair(
      client,
      ctx(EXECUTOR),
      {
        repairBatchId: batch.id,
        anomalyId: anomaly.id,
        repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
        reason: 'Reverse duplicate',
        proposedJournal: { lines: anomaly.proposedRepairData.lines },
        postingDate: '2026-03-05',
      },
      { hasPermission: allow }
    );
    await transitionBatch(client, ctx(EXECUTOR), batch.id, 'COMPLETED');

    const verification = await verifyBatch(client, ctx(APPROVER), batch.id, {});
    expect(verification.passed).toBe(true);
    // The reversal adds 80/80: delta must be balanced.
    expect(verification.delta.debitMinor).toBe(8000);
    expect(verification.delta.creditMinor).toBe(8000);
    expect(data.repairBatches.find((b) => b.id === batch.id).status).toBe('VERIFIED');
    expect(data.anomalies.find((a) => a.id === anomaly.id).status).toBe(AnomalyStatus.VERIFIED);
    expect(data.repairSnapshots.filter((s) => s.batchId === batch.id)).toHaveLength(2);
  });

  it('fails verification when a repair journal is missing (deletion is a violation)', async () => {
    const { client, data } = makeAcctV2PrismaStub(repairSeed());
    const anomaly = await approvedAnomaly(client, {
      anomalyType: 'DUPLICATE_JOURNAL',
      detectionKey: 'k-verify-del',
      repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
      repairData: {
        lines: [{ accountId: 'cash', debit: '80.00' }, { accountId: 'exp-gen', credit: '80.00' }],
        transactionDate: '2026-03-05',
      },
    });
    const batch = await approvedBatch(client, 'DUP');
    await captureSnapshot(client, ctx(EXECUTOR), batch.id, 'BEFORE');
    await executeRepair(
      client,
      ctx(EXECUTOR),
      {
        repairBatchId: batch.id,
        anomalyId: anomaly.id,
        repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
        reason: 'Reverse duplicate',
        proposedJournal: { lines: anomaly.proposedRepairData.lines },
        postingDate: '2026-03-05',
      },
      { hasPermission: allow }
    );
    await transitionBatch(client, ctx(EXECUTOR), batch.id, 'COMPLETED');
    // Simulate an out-of-band deletion of the repair journal (forbidden).
    const idx = data.legacyJournalEntries.findIndex((j) => j.entryType === 'HistoricalRepair');
    data.legacyJournalEntries.splice(idx, 1);
    const verification = await verifyBatch(client, ctx(APPROVER), batch.id, {});
    expect(verification.passed).toBe(false);
    expect(verification.failures.some((f) => /never be deleted/.test(f))).toBe(true);
    expect(data.repairBatches.find((b) => b.id === batch.id).status).toBe('FAILED');
  });
});

/* ── 58.14 Security ──────────────────────────────────────────────────────── */

describe('multi-tenant security', () => {
  it('refuses execution against a cross-business batch or anomaly', async () => {
    const { client } = makeAcctV2PrismaStub(repairSeed());
    const anomaly = await approvedAnomaly(client, {
      anomalyType: 'DUPLICATE_JOURNAL',
      detectionKey: 'k-sec',
      repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
      repairData: { lines: [{ accountId: 'cash', debit: '80.00' }, { accountId: 'exp-gen', credit: '80.00' }] },
    });
    const batch = await approvedBatch(client);
    // A user in T2 cannot touch T1's anomaly/batch.
    await expect(
      executeRepair(
        client,
        ctx(EXECUTOR, T2),
        {
          repairBatchId: batch.id,
          anomalyId: anomaly.id,
          repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
          reason: 'cross-tenant attempt',
          proposedJournal: { lines: anomaly.proposedRepairData.lines },
        },
        { hasPermission: allow }
      )
    ).rejects.toThrow(/not found/);
  });

  it('refuses execution while the batch is unapproved', async () => {
    const { client } = makeAcctV2PrismaStub(repairSeed());
    const anomaly = await approvedAnomaly(client, {
      anomalyType: 'DUPLICATE_JOURNAL',
      detectionKey: 'k-unapproved',
      repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
      repairData: { lines: [{ accountId: 'cash', debit: '80.00' }, { accountId: 'exp-gen', credit: '80.00' }] },
    });
    const batch = await createBatch(client, ctx(INVESTIGATOR), {
      repairCategory: 'DUP',
      description: 'unapproved',
      backupReference: 'b',
    });
    await expect(
      executeRepair(
        client,
        ctx(EXECUTOR),
        {
          repairBatchId: batch.id,
          anomalyId: anomaly.id,
          repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
          reason: 'premature',
          proposedJournal: { lines: anomaly.proposedRepairData.lines },
        },
        { hasPermission: allow }
      )
    ).rejects.toThrow(/must be approved/);
  });

  it('refuses execution of an unapproved anomaly even inside an approved batch', async () => {
    const { client } = makeAcctV2PrismaStub(repairSeed());
    const anomaly = await recordAnomaly(client, ctx(), {
      findingCode: 'T',
      anomalyType: 'DUPLICATE_JOURNAL',
      detectionKey: 'k-noapproval',
      confidence: ConfidenceLevel.CONFIRMED,
    });
    const batch = await approvedBatch(client);
    await expect(
      executeRepair(
        client,
        ctx(EXECUTOR),
        {
          repairBatchId: batch.id,
          anomalyId: anomaly.id,
          repairType: RepairType.DUPLICATE_EFFECT_REPAIR,
          reason: 'no approval',
          proposedJournal: { lines: [{ accountId: 'cash', debit: '1.00' }, { accountId: 'exp-gen', credit: '1.00' }] },
        },
        { hasPermission: allow }
      )
    ).rejects.toThrow(/approved for repair/);
  });
});

/* ── 29 Unsupported liabilities: no invented journals ────────────────────── */

describe('unsupported balances', () => {
  it('UNSUPPORTED confidence can never reach approval — exception is the only path', async () => {
    const { client, data } = makeAcctV2PrismaStub(repairSeed());
    const anomaly = await recordAnomaly(client, ctx(), {
      findingCode: 'P6-LIAB-001',
      anomalyType: 'UNSUPPORTED_LIABILITY',
      detectionKey: 'k-liab',
      confidence: ConfidenceLevel.UNSUPPORTED,
      financialImpactMinor: 12345600n,
    });
    await proposeRepair(client, ctx(), anomaly.id, {
      repairType: RepairType.MISSING_JOURNAL_REPAIR,
      reason: 'attempt to invent a liability journal',
    });
    await expect(decideRepair(client, ctx(APPROVER), anomaly.id, { approve: true })).rejects.toThrow(
      /does not permit repair approval/
    );
    // The exception path keeps the amount visible for Phase 7 disclosure.
    await decideRepair(client, ctx(APPROVER), anomaly.id, { approve: false, reason: 'no evidence' });
    await transitionAnomaly(client, ctx(), anomaly.id, AnomalyStatus.UNDER_INVESTIGATION);
    await markException(client, ctx(APPROVER), anomaly.id, {
      evidenceGap: 'No creditor evidence',
      reasonBlocked: 'Unsupported balance; awaiting supplier statements.',
      disclosureRequired: true,
    });
    expect(data.repairExceptions[0].amountMinor).toBe(12345600n);
    expect(data.repairExceptions[0].disclosureRequired).toBe(true);
  });
});
