/**
 * Phase 8 — Financial Calendar, Accounting Periods and Period Control tests.
 *
 * Covers: monthly period generation (leap years, mid-calendar-year starts,
 * coverage validation), atomic financial-year creation with rollback,
 * financial-year opening, calendar integrity rules (PER-101…PER-110), the
 * date-policy framework (backdating / future-dating / lock dates), the
 * canonical Period Resolution Service (open/closed/reopened/closing periods,
 * boundary days, gaps, overlaps, no silent fallback, cross-business
 * isolation), posting-engine integration behind the resolver flag, the close
 * workflow (checklist materialization, automated checks against canonical
 * reports, manual tasks with evidence, waivers, exceptions, separation of
 * duties, atomic closure with snapshots + history + outbox, blocked closure
 * on an unbalanced Trial Balance with no balancing entry), reopening
 * (impact analysis, approval, restricted status) and re-closing (new run
 * version, snapshot supersession with preservation), and the legacy period
 * migration (preview, execute, idempotent rerun, empty database).
 */

import { describe, it, expect } from 'vitest';
import { makeAcctV2PrismaStub } from './helpers/acctV2PrismaStub.js';
import { createAccountingContext } from '../lib/accountingV2/domain/accountingContext.js';
import {
  computeFinancialYearRange,
  generateMonthlyPeriods,
  validatePeriodCoverage,
  financialYearCode,
  toDateOnly,
  isoDate,
} from '../lib/accountingV2/periods/periodGeneration.js';
import { evaluatePostingDate } from '../lib/accountingV2/periods/datePolicy.js';
import { getCalendarConfig, updateCalendarConfig, CALENDAR_CONFIG_DEFAULTS } from '../lib/accountingV2/periods/calendarConfigService.js';
import {
  previewFinancialYear,
  createFinancialYear,
  openFinancialYear,
  getFinancialYear,
} from '../lib/accountingV2/periods/financialYearService.js';
import { runCalendarIntegrityAudit, getCalendarSummary } from '../lib/accountingV2/periods/calendarIntegrityService.js';
import { resolvePeriodV2, validatePostingDate } from '../lib/accountingV2/periods/periodResolutionService.js';
import { resolvePostingPeriod } from '../lib/accountingV2/engine/periodResolution.js';
import { getPeriodStatusHistory, setPeriodLockDate, transitionPeriod } from '../lib/accountingV2/periods/periodLifecycleService.js';
import { getChecklistTemplate, listChecklistTemplates } from '../lib/accountingV2/periods/periodCloseChecklist.js';
import {
  beginPeriodClose,
  cancelPeriodClose,
  runAutomatedCloseChecks,
  updateManualCloseTask,
  waiveCloseTask,
  addCloseException,
  acceptExceptionForClose,
  submitCloseForReview,
  approveCloseRun,
  closePeriod,
  getCloseRun,
} from '../lib/accountingV2/periods/periodCloseService.js';
import {
  computeReopenImpact,
  requestReopen,
  approveReopen,
  rejectReopen,
} from '../lib/accountingV2/periods/periodReopenService.js';
import { runPeriodMonitoring } from '../lib/accountingV2/periods/periodMonitoringService.js';
import { assessPeriodReadiness } from '../lib/accountingV2/periods/periodReadinessService.js';
import {
  previewLegacyPeriodMigration,
  executeLegacyPeriodMigration,
} from '../lib/accountingV2/periods/legacyPeriodMigrationService.js';
import { ACCOUNTING_PERMISSIONS } from '../lib/accountingV2/permissions.js';
import { PERIOD_FLAGS } from '../lib/accountingV2/infrastructure/featureFlags.js';

const T1 = 'tenant-1';
const T2 = 'tenant-2';
const ctx = (businessId = T1, userId = 'user-1') =>
  createAccountingContext({ businessId, userId, sourceChannel: 'test' });
const D = (s) => new Date(s);
const NOW = D('2026-07-15T10:00:00.000Z');
const allow = (...keys) => (key) => keys.includes(key);
const allowAll = () => true;
const denyAll = () => false;

/* ── Balanced canonical books (compact version of the Phase 7 fixture) ────── */

const chart = () => [
  { id: 'cash', tenantId: T1, accountCode: '1000', accountName: 'Cash on Hand', accountType: 'Asset', coaV2Category: 'ASSET', systemPurpose: 'CASH', isActive: true },
  { id: 'ar', tenantId: T1, accountCode: '1100', accountName: 'Accounts Receivable', accountType: 'Asset', coaV2Category: 'ASSET', coaV2SubType: 'ACCOUNTS_RECEIVABLE', controlAccountPurpose: 'ACCOUNTS_RECEIVABLE', isActive: true },
  { id: 'inv', tenantId: T1, accountCode: '1200', accountName: 'Inventory', accountType: 'Asset', coaV2Category: 'ASSET', coaV2SubType: 'INVENTORY', isActive: true },
  { id: 'ap', tenantId: T1, accountCode: '2000', accountName: 'Accounts Payable', accountType: 'Liability', coaV2Category: 'LIABILITY', coaV2SubType: 'ACCOUNTS_PAYABLE', controlAccountPurpose: 'ACCOUNTS_PAYABLE', isActive: true },
  { id: 'capital', tenantId: T1, accountCode: '3000', accountName: 'Owner Capital', accountType: 'Equity', coaV2Category: 'EQUITY', coaV2SubType: 'OWNER_CAPITAL', isActive: true },
  { id: 'rev', tenantId: T1, accountCode: '4000', accountName: 'Sales Revenue', accountType: 'Income', coaV2Category: 'REVENUE', isActive: true },
  { id: 'cogs', tenantId: T1, accountCode: '5000', accountName: 'Cost of Sales', accountType: 'Expense', coaV2Category: 'COST_OF_SALES', isActive: true },
  { id: 'rent', tenantId: T1, accountCode: '5300', accountName: 'Rent Expense', accountType: 'Expense', coaV2Category: 'EXPENSE', isActive: true },
];

const v2Je = (id, date, lines, extras = {}) => ({
  header: {
    id,
    tenantId: T1,
    transactionId: null,
    status: extras.status ?? 'Posted',
    entryDate: D(date),
    postingDate: D(date),
    description: extras.description ?? id,
    createdAt: D(date),
    architectureVersion: 'ACCOUNTING_V2',
  },
  lines: lines.map(([accountId, debit, credit], i) => ({
    id: `${id}-l${i}`,
    journalEntryId: id,
    lineNumber: i + 1,
    accountId,
    debitAmount: debit,
    creditAmount: credit,
  })),
});

function seedBooks({ unbalanced = false } = {}) {
  const journals = [
    v2Je('tx-capital', '2026-06-01', [['cash', 1000000, 0], ['capital', 0, 1000000]]),
    v2Je('tx-stock', '2026-06-25', [['inv', 90000, 0], ['ap', 0, 90000]]),
    v2Je('tx-sale', '2026-07-03', [['ar', 115000, 0], ['rev', 0, 115000]]),
    v2Je('tx-receipt', '2026-07-10', [['cash', 57500, 0], ['ar', 0, 57500]]),
    v2Je('tx-cogs', '2026-07-10', [['cogs', 40000, 0], ['inv', 0, 40000]]),
    v2Je('tx-appay', '2026-07-12', [['ap', 30000, 0], ['cash', 0, 30000]]),
    v2Je('tx-rent', '2026-07-15', [['rent', 10000, 0], ['cash', 0, 10000]]),
  ];
  if (unbalanced) {
    journals.push(
      v2Je('je-unbal', '2026-07-21', [['rent', 100, 0]], { description: 'Unbalanced V2 journal' })
    );
  }
  return makeAcctV2PrismaStub({
    accounts: chart(),
    legacyTransactions: [],
    transactionLines: [],
    legacyJournalEntries: journals.map((j) => j.header),
    journalEntryLines: journals.flatMap((j) => j.lines),
    invoices: [
      { id: 'inv1', tenantId: T1, invoiceNumber: 'INV-001', clientId: 'c1', isDeleted: false, status: 'sent', issueDate: D('2026-07-03'), dueDate: D('2026-07-15'), total: 115000, remainingBalance: 57500 },
    ],
    supplierBills: [
      { id: 'bill1', tenantId: T1, billNumber: 'BILL-001', supplierId: 's1', status: 'Approved', billDate: D('2026-06-25'), dueDate: D('2026-07-10'), totalAmount: 90000, amountPaid: 30000 },
    ],
  });
}

/** Create + open FY2026 (Jan–Dec) for T1 and return its periods. */
async function seedCalendar(client, context = ctx()) {
  const { financialYear } = await createFinancialYear(client, context, { startYear: 2026 });
  await openFinancialYear(client, context, financialYear.id);
  const detail = await getFinancialYear(client, context, financialYear.id);
  return detail;
}

const julyOf = (periods) => periods.find((p) => p.name === 'July 2026');

/** Drive a period through checklist completion up to READY_FOR_REVIEW. */
async function completeChecklist(client, context, closeRunId) {
  await runAutomatedCloseChecks(client, context, closeRunId);
  const { tasks } = await getCloseRun(client, context, closeRunId);
  for (const task of tasks.filter((t) => t.kind === 'MANUAL')) {
    await updateManualCloseTask(client, context, closeRunId, task.taskKey, {
      status: 'PASSED',
      comment: 'Reviewed in test',
      evidence: { note: 'test evidence' },
    });
  }
  return submitCloseForReview(client, context, closeRunId);
}

/* ── Period generation ─────────────────────────────────────────────────────── */

describe('automatic period generation', () => {
  it('generates twelve calendar months for a January–December year', () => {
    const range = computeFinancialYearRange({ startYear: 2027, startMonth: 1, startDay: 1 });
    expect(isoDate(range.startDate)).toBe('2027-01-01');
    expect(isoDate(range.endDate)).toBe('2027-12-31');
    const periods = generateMonthlyPeriods({ fyCode: 'FY2027', ...range });
    expect(periods).toHaveLength(12);
    expect(periods[0]).toMatchObject({ periodNumber: 1, name: 'January 2027', code: 'FY2027-P01' });
    expect(isoDate(periods[1].startDate)).toBe('2027-02-01');
    expect(isoDate(periods[1].endDate)).toBe('2027-02-28'); // non-leap February
    expect(isoDate(periods[3].endDate)).toBe('2027-04-30'); // 30-day month
    expect(isoDate(periods[6].endDate)).toBe('2027-07-31'); // 31-day month
    expect(validatePeriodCoverage(range, periods)).toEqual([]);
  });

  it('handles leap-year February correctly', () => {
    const range = computeFinancialYearRange({ startYear: 2028, startMonth: 1, startDay: 1 });
    const periods = generateMonthlyPeriods({ fyCode: 'FY2028', ...range });
    expect(isoDate(periods[1].endDate)).toBe('2028-02-29');
    expect(validatePeriodCoverage(range, periods)).toEqual([]);
  });

  it('supports a July–June financial year with no gaps or overlaps', () => {
    const range = computeFinancialYearRange({ startYear: 2026, startMonth: 7, startDay: 1 });
    expect(isoDate(range.startDate)).toBe('2026-07-01');
    expect(isoDate(range.endDate)).toBe('2027-06-30');
    const periods = generateMonthlyPeriods({ fyCode: financialYearCode(range.startDate), ...range });
    expect(periods[0].name).toBe('July 2026');
    expect(periods[11].name).toBe('June 2027');
    expect(periods[11].code).toBe('FY2026-P12');
    expect(isoDate(periods[7].endDate)).toBe('2027-02-28'); // Feb inside the year
    expect(validatePeriodCoverage(range, periods)).toEqual([]);
  });

  it('detects gaps, overlaps and out-of-year periods in coverage validation', () => {
    const range = computeFinancialYearRange({ startYear: 2026, startMonth: 1, startDay: 1 });
    const periods = generateMonthlyPeriods({ fyCode: 'FY2026', ...range });
    const gapped = periods.map((p, i) => (i === 5 ? { ...p, startDate: new Date(p.startDate.getTime() + 86400000) } : p));
    expect(validatePeriodCoverage(range, gapped).join(' ')).toMatch(/Gap/);
    const overlapped = periods.map((p, i) => (i === 5 ? { ...p, startDate: new Date(p.startDate.getTime() - 86400000) } : p));
    expect(validatePeriodCoverage(range, overlapped).join(' ')).toMatch(/Overlap/);
  });
});

/* ── Calendar configuration ────────────────────────────────────────────────── */

describe('financial calendar configuration', () => {
  it('returns safe defaults when no configuration row exists', async () => {
    const { client } = makeAcctV2PrismaStub();
    const config = await getCalendarConfig(client, ctx());
    expect(config.fyStartMonth).toBe(CALENDAR_CONFIG_DEFAULTS.fyStartMonth);
    expect(config.persisted).toBe(false);
  });

  it('persists changes with validation and audit, and requires a reason for lock dates', async () => {
    const { client, data } = makeAcctV2PrismaStub();
    await updateCalendarConfig(client, ctx(), { fyStartMonth: 7 });
    const config = await getCalendarConfig(client, ctx());
    expect(config.fyStartMonth).toBe(7);
    expect(data.auditLogs.some((a) => a.action === 'acctv2.calendar.configChange')).toBe(true);
    await expect(updateCalendarConfig(client, ctx(), { fyStartMonth: 13 })).rejects.toThrow(/1–12/);
    await expect(updateCalendarConfig(client, ctx(), { lockDate: '2026-06-30' })).rejects.toThrow(/reason/);
  });
});

/* ── Financial year creation ───────────────────────────────────────────────── */

describe('financial year creation and opening', () => {
  it('previews, creates atomically and opens a financial year with periods', async () => {
    const { client, data } = makeAcctV2PrismaStub();
    const context = ctx();
    const preview = await previewFinancialYear(client, context, { startYear: 2026 });
    expect(preview.periods).toHaveLength(12);
    expect(preview.issues).toEqual([]);

    const { financialYear, periods } = await createFinancialYear(client, context, { startYear: 2026 });
    expect(financialYear.status).toBe('DRAFT');
    expect(periods.every((p) => p.status === 'DRAFT')).toBe(true);

    await openFinancialYear(client, context, financialYear.id);
    const detail = await getFinancialYear(client, context, financialYear.id);
    expect(detail.financialYear.status).toBe('OPEN');
    expect(detail.financialYear.isCurrent).toBe(true);
    expect(detail.periods.every((p) => p.status === 'OPEN')).toBe(true);
    // history recorded for the year and every period
    expect(data.periodStatusHistory.filter((h) => h.action === 'OPEN').length).toBeGreaterThanOrEqual(13);
  });

  it('rejects overlapping financial years', async () => {
    const { client } = makeAcctV2PrismaStub();
    await createFinancialYear(client, ctx(), { startYear: 2026 });
    await expect(createFinancialYear(client, ctx(), { startYear: 2026 })).rejects.toThrow(/Overlaps existing financial year/);
  });

  it('rolls back the whole year when any period creation fails (atomicity)', async () => {
    const { client, data, state } = makeAcctV2PrismaStub();
    state.failOn = 'acctV2AccountingPeriod.create';
    await expect(createFinancialYear(client, ctx(), { startYear: 2026 })).rejects.toThrow(/Simulated failure/);
    expect(data.financialYears).toHaveLength(0);
    expect(data.accountingPeriodsV2).toHaveLength(0);
  });

  it('is business-scoped: another business cannot read the year', async () => {
    const { client } = makeAcctV2PrismaStub();
    const { financialYear } = await createFinancialYear(client, ctx(), { startYear: 2026 });
    await expect(getFinancialYear(client, ctx(T2), financialYear.id)).rejects.toThrow(/not found/i);
  });
});

/* ── Calendar integrity (PER rules) ────────────────────────────────────────── */

describe('calendar integrity service', () => {
  it('passes for a cleanly generated calendar', async () => {
    const { client } = makeAcctV2PrismaStub();
    await seedCalendar(client);
    const audit = await runCalendarIntegrityAudit(client, ctx(), { now: NOW });
    expect(audit.status).toBe('PASS');
    expect(audit.findings).toEqual([]);
  });

  it('detects overlaps, gaps, duplicates and multiple current years', async () => {
    const { client, data } = makeAcctV2PrismaStub();
    const { periods } = await seedCalendar(client);
    // Tamper: overlap July into June, gap before October, second current year.
    const july = data.accountingPeriodsV2.find((p) => p.id === julyOf(periods).id);
    july.startDate = D('2026-06-15');
    const october = data.accountingPeriodsV2.find((p) => p.name === 'October 2026');
    october.startDate = D('2026-10-05');
    data.financialYears.push({ ...data.financialYears[0], id: 'fy-dup', code: 'FY2030', startDate: D('2030-01-01'), endDate: D('2030-12-31'), isCurrent: true });
    const audit = await runCalendarIntegrityAudit(client, ctx(), { now: NOW });
    const rules = audit.findings.map((f) => f.rule);
    expect(rules).toContain('PER-102');
    expect(rules).toContain('PER-103');
    expect(rules).toContain('PER-109');
  });

  it('reports the calendar summary with current period and days remaining', async () => {
    const { client } = makeAcctV2PrismaStub();
    await seedCalendar(client);
    const summary = await getCalendarSummary(client, ctx(), { now: NOW });
    expect(summary.currentFinancialYear.code).toBe('FY2026');
    expect(summary.currentPeriod.name).toBe('July 2026');
    expect(summary.currentPeriodDaysRemaining).toBe(16);
  });
});

/* ── Date policy ───────────────────────────────────────────────────────────── */

describe('date policy framework', () => {
  const config = { ...CALENDAR_CONFIG_DEFAULTS };

  it('resolves the posting date, preserving the transaction date separately', () => {
    const result = evaluatePostingDate(config, { transactionDate: '2026-07-03', requestedPostingDate: '2026-07-05', now: NOW });
    expect(result.resolvedPostingDate).toBe('2026-07-05');
    expect(result.transactionDate).toBe('2026-07-03');
    expect(result.violations).toEqual([]);
  });

  it('flags backdating and requires permission + reason under the default policy', () => {
    const result = evaluatePostingDate(config, { transactionDate: '2026-06-10', now: NOW });
    expect(result.isBackdated).toBe(true);
    expect(result.requiresBackdatingPermission).toBe(true);
    expect(result.requiresBackdatingReason).toBe(true);
  });

  it('rejects future dates beyond tolerance and everything under a REJECT policy', () => {
    const beyond = evaluatePostingDate(config, { transactionDate: '2026-09-30', now: NOW });
    expect(beyond.violations.map((v) => v.code)).toContain('FUTURE_DATE_BEYOND_TOLERANCE');
    const strict = evaluatePostingDate({ ...config, futureDatingPolicy: 'REJECT' }, { transactionDate: '2026-07-16', now: NOW });
    expect(strict.violations.map((v) => v.code)).toContain('FUTURE_DATING_REJECTED');
  });

  it('enforces the business lock date', () => {
    const result = evaluatePostingDate({ ...config, lockDate: '2026-06-30' }, { transactionDate: '2026-06-15', now: NOW });
    expect(result.violations.map((v) => v.code)).toContain('LOCK_DATE');
  });
});

/* ── Period resolution ─────────────────────────────────────────────────────── */

describe('period resolution service', () => {
  it('resolves year and period from the posting date, including boundary days', async () => {
    const { client } = makeAcctV2PrismaStub();
    const { periods } = await seedCalendar(client);
    for (const date of ['2026-07-01', '2026-07-15', '2026-07-31']) {
      const r = await resolvePeriodV2(client, ctx(), {
        transactionDate: date, hasPermission: denyAll, now: date === '2026-07-31' ? D('2026-07-31T12:00:00Z') : NOW,
      });
      expect(r.accountingPeriodId).toBe(julyOf(periods).id);
      expect(r.financialYearCode).toBe('FY2026');
      expect(r.periodStatus).toBe('OPEN');
    }
  });

  it('never falls back silently when no year or period covers the date', async () => {
    const { client } = makeAcctV2PrismaStub();
    await seedCalendar(client);
    await expect(
      resolvePeriodV2(client, ctx(), { transactionDate: '2020-05-01', hasPermission: allowAll, now: NOW })
    ).rejects.toThrow(/No financial year covers/);
  });

  it('rejects posting into a CLOSED period with a typed, audited error', async () => {
    const { client, data } = makeAcctV2PrismaStub();
    const { periods } = await seedCalendar(client);
    const july = data.accountingPeriodsV2.find((p) => p.id === julyOf(periods).id);
    july.status = 'CLOSED';
    await expect(
      resolvePeriodV2(client, ctx(), { transactionDate: '2026-07-10', hasPermission: allowAll, now: NOW })
    ).rejects.toMatchObject({ name: 'ClosedAccountingPeriodError' });
    expect(data.auditLogs.some((a) => a.action === 'acctv2.period.postingRejected')).toBe(true);
  });

  it('requires authorization for REOPENED and CLOSING periods', async () => {
    const { client, data } = makeAcctV2PrismaStub();
    const { periods } = await seedCalendar(client);
    const july = data.accountingPeriodsV2.find((p) => p.id === julyOf(periods).id);
    july.status = 'REOPENED';
    await expect(
      resolvePeriodV2(client, ctx(), { transactionDate: '2026-07-10', hasPermission: denyAll, now: NOW })
    ).rejects.toThrow(/reopened/i);
    const authorized = await resolvePeriodV2(client, ctx(), {
      transactionDate: '2026-07-10',
      hasPermission: allow(ACCOUNTING_PERMISSIONS.PERIODS_POST_ADJUSTMENTS),
      now: NOW,
    });
    expect(authorized.requiresApproval).toBe(true);
    expect(authorized.resolutionRule).toBe('REOPENED_PERIOD_CORRECTION');

    july.status = 'CLOSING';
    await expect(
      resolvePeriodV2(client, ctx(), { transactionDate: '2026-07-10', hasPermission: denyAll, now: NOW })
    ).rejects.toThrow(/being closed/i);
  });

  it('enforces backdating permission and marks backdated resolutions', async () => {
    const { client } = makeAcctV2PrismaStub();
    await seedCalendar(client);
    await expect(
      resolvePeriodV2(client, ctx(), { transactionDate: '2026-06-10', hasPermission: denyAll, now: NOW })
    ).rejects.toThrow(/backdating permission/i);
    const r = await resolvePeriodV2(client, ctx(), {
      transactionDate: '2026-06-10',
      hasPermission: allow(ACCOUNTING_PERMISSIONS.POSTING_BACKDATE),
      now: NOW,
    });
    expect(r.isBackdated).toBe(true);
    expect(r.requiresApproval).toBe(true);
    expect(r.periodName).toBe('June 2026');
  });

  it('rejects far-future dates and allows in-tolerance future dates with a warning', async () => {
    const { client } = makeAcctV2PrismaStub();
    await seedCalendar(client);
    await expect(
      resolvePeriodV2(client, ctx(), { transactionDate: '2026-09-30', hasPermission: allowAll, now: NOW })
    ).rejects.toThrow(/future/i);
    const nearFuture = await resolvePeriodV2(client, ctx(), { transactionDate: '2026-07-20', hasPermission: denyAll, now: NOW });
    expect(nearFuture.isFutureDated).toBe(true);
    expect(nearFuture.warnings.join(' ')).toMatch(/future-dated/i);
  });

  it('enforces period lock dates below period status', async () => {
    const { client, data } = makeAcctV2PrismaStub();
    const { periods } = await seedCalendar(client);
    const july = data.accountingPeriodsV2.find((p) => p.id === julyOf(periods).id);
    july.lockDate = D('2026-07-31');
    await expect(
      resolvePeriodV2(client, ctx(), { transactionDate: '2026-07-10', hasPermission: denyAll, now: NOW })
    ).rejects.toThrow(/lock date/i);
  });

  it('is business-scoped: another business resolves nothing from this calendar', async () => {
    const { client } = makeAcctV2PrismaStub();
    await seedCalendar(client);
    await expect(
      resolvePeriodV2(client, ctx(T2), { transactionDate: '2026-07-10', hasPermission: allowAll, now: NOW })
    ).rejects.toThrow(/No financial year/);
  });

  it('validatePostingDate returns a safe non-throwing result for guards', async () => {
    const { client } = makeAcctV2PrismaStub();
    await seedCalendar(client);
    const ok = await validatePostingDate(client, ctx(), { transactionDate: '2026-07-10', hasPermission: denyAll, now: NOW });
    expect(ok.allowed).toBe(true);
    const bad = await validatePostingDate(client, ctx(), { transactionDate: '2020-01-01', hasPermission: denyAll, now: NOW });
    expect(bad.allowed).toBe(false);
    expect(bad.error.message).toMatch(/No financial year/);
  });
});

/* ── Posting engine integration ────────────────────────────────────────────── */

describe('posting engine period integration', () => {
  it('uses the canonical resolver when the flag is enabled for the business', async () => {
    const { client, data } = makeAcctV2PrismaStub({
      featureFlags: [{ id: 'f1', tenantId: T1, flagKey: PERIOD_FLAGS.RESOLVER_V2, moduleKey: '*', eventType: '*', enabled: true }],
    });
    const { periods } = await seedCalendar(client);
    const resolution = await resolvePostingPeriod(client, ctx(), {
      transactionDate: '2026-07-10',
      hasPermission: denyAll,
    });
    expect(resolution.accountingPeriodId).toBe(julyOf(periods).id);
    expect(resolution.financialYearLabel).toBe('FY2026');
    expect(data.accountingPeriods).toHaveLength(0); // legacy table untouched
  });

  it('keeps the Phase 4 legacy-table behaviour when the flag is off', async () => {
    const { client } = makeAcctV2PrismaStub({
      accountingPeriods: [
        { id: 'lp-jul', tenantId: T1, name: 'Jul 2026', periodType: 'Monthly', startDate: D('2026-07-01'), endDate: D('2026-07-31T23:59:59.999Z'), status: 'open' },
      ],
    });
    const resolution = await resolvePostingPeriod(client, ctx(), {
      transactionDate: '2026-07-10',
      hasPermission: denyAll,
    });
    expect(resolution.accountingPeriodId).toBe('lp-jul');
  });
});

/* ── Close workflow ────────────────────────────────────────────────────────── */

describe('period close workflow', () => {
  it('publishes an immutable checklist template', () => {
    const template = getChecklistTemplate('STANDARD_MONTHLY_CLOSE', '1.0.0');
    expect(Object.isFrozen(template)).toBe(true);
    expect(template.tasks.length).toBeGreaterThanOrEqual(20);
    expect(() => getChecklistTemplate('STANDARD_MONTHLY_CLOSE', '9.9.9')).toThrow(/not published/);
    expect(listChecklistTemplates()[0].taskCount).toBe(template.tasks.length);
  });

  it('runs the full close: begin → checks → manual tasks → review → approve → atomic closure', async () => {
    const { client, data } = seedBooks();
    const context = ctx();
    const { periods } = await seedCalendar(client, context);
    const july = julyOf(periods);

    const run = await beginPeriodClose(client, context, july.id, { reason: 'Month-end close' });
    expect(run.closeNumber).toBe(1);
    expect(run.checklistTemplateVersion).toBe('1.0.0');
    expect(data.accountingPeriodsV2.find((p) => p.id === july.id).status).toBe('CLOSING');
    expect(data.periodCloseTasks.filter((t) => t.closeRunId === run.id).length).toBe(21);
    await expect(beginPeriodClose(client, context, july.id, {})).rejects.toThrow(/OPEN or REOPENED|already active/);

    const checks = await runAutomatedCloseChecks(client, context, run.id);
    expect(checks.run.status).toBe('IN_PROGRESS');
    expect(checks.run.trialBalanceStatus).toMatch(/BALANCED/);
    expect(checks.run.blockedTaskCount).toBe(0);

    // Manual completion requires evidence or comment.
    await expect(
      updateManualCloseTask(client, context, run.id, 'PAYROLL_REVIEWED', { status: 'PASSED' })
    ).rejects.toThrow(/evidence/i);

    const submitted = await completeChecklist(client, context, run.id);
    expect(submitted.status).toBe('READY_FOR_REVIEW');

    // Separation of duties: initiator cannot approve.
    await expect(approveCloseRun(client, context, run.id, {})).rejects.toThrow(/Separation of duties/);
    const approver = ctx(T1, 'user-2');
    const approved = await approveCloseRun(client, approver, run.id, { comment: 'Reviewed and approved' });
    expect(approved.status).toBe('APPROVED');

    const closed = await closePeriod(client, approver, run.id, { reason: 'July close' });
    expect(closed.period.status).toBe('CLOSED');
    expect(closed.run.status).toBe('COMPLETED');
    expect(closed.run.snapshotReferences).toHaveLength(5); // TB/IS/BS/CF/Equity
    expect(data.reportSnapshots.length).toBe(5);
    expect(data.outbox.some((m) => m.eventType === 'PERIOD_CLOSED')).toBe(true);
    const history = await getPeriodStatusHistory(client, context, july.id);
    expect(history.map((h) => h.action)).toContain('CLOSE');

    // Posting into the closed period is now rejected.
    await expect(
      resolvePeriodV2(client, context, { transactionDate: '2026-07-28', hasPermission: allowAll, now: D('2026-08-02T08:00:00Z') })
    ).rejects.toMatchObject({ name: 'ClosedAccountingPeriodError' });
  });

  it('blocks closure on an unbalanced Trial Balance and creates no balancing entry', async () => {
    const { client, data } = seedBooks({ unbalanced: true });
    const context = ctx();
    const { periods } = await seedCalendar(client, context);
    const run = await beginPeriodClose(client, context, julyOf(periods).id, {});
    const journalCountBefore = data.legacyJournalEntries.length + data.legacyTransactions.length;

    const checks = await runAutomatedCloseChecks(client, context, run.id);
    expect(checks.run.status).toBe('BLOCKED');
    const tbTask = data.periodCloseTasks.find((t) => t.closeRunId === run.id && t.taskKey === 'TB_BALANCED');
    expect(tbTask.status).toBe('FAILED');
    await expect(submitCloseForReview(client, context, run.id)).rejects.toThrow(/cannot close|Blocking task/i);

    // No balancing journal was created and the period remains unclosed.
    expect(data.legacyJournalEntries.length + data.legacyTransactions.length).toBe(journalCountBefore);
    expect(data.accountingPeriodsV2.find((p) => p.id === julyOf(periods).id).status).toBe('CLOSING');
  });

  it('cancelling a close returns the period to OPEN with history', async () => {
    const { client, data } = seedBooks();
    const context = ctx();
    const { periods } = await seedCalendar(client, context);
    const run = await beginPeriodClose(client, context, julyOf(periods).id, {});
    await cancelPeriodClose(client, context, run.id, { reason: 'Not ready' });
    expect(data.accountingPeriodsV2.find((p) => p.id === julyOf(periods).id).status).toBe('OPEN');
    expect(data.periodCloseRuns.find((r) => r.id === run.id).status).toBe('CANCELLED');
    const history = await getPeriodStatusHistory(client, context, julyOf(periods).id);
    expect(history.map((h) => h.action)).toContain('CANCEL_CLOSE');
  });

  it('waivers on blocking tasks require the override permission and a reason', async () => {
    const { client } = seedBooks();
    const context = ctx();
    const { periods } = await seedCalendar(client, context);
    const run = await beginPeriodClose(client, context, julyOf(periods).id, {});
    await expect(
      waiveCloseTask(client, context, run.id, 'TB_BALANCED', { reason: 'skip', can: denyAll })
    ).rejects.toThrow(/materiality-override/);
    await expect(
      waiveCloseTask(client, context, run.id, 'TB_BALANCED', { reason: null, can: allowAll })
    ).rejects.toThrow(/reason/);
    const waived = await waiveCloseTask(client, context, run.id, 'SUSPENSE_REVIEWED', { reason: 'No suspense activity this month', can: denyAll });
    expect(waived.status).toBe('WAIVED');
  });

  it('never accepts always-blocking exception categories and gates high severity', async () => {
    const { client } = seedBooks();
    const context = ctx();
    const { periods } = await seedCalendar(client, context);
    const july = julyOf(periods);
    const fatal = await addCloseException(client, context, july.id, {
      category: 'CROSS_TENANT_REFERENCE', severity: 'CRITICAL', description: 'Journal references another business',
    });
    await expect(acceptExceptionForClose(client, context, fatal.id, { reason: 'try', can: allowAll })).rejects.toThrow(/never be accepted/);
    const high = await addCloseException(client, context, july.id, {
      category: 'SUBLEDGER_DIFFERENCE', severity: 'HIGH', amountMinor: 500, description: 'Small AR timing difference',
    });
    await expect(acceptExceptionForClose(client, context, high.id, { reason: 'immaterial', can: denyAll })).rejects.toThrow(/materiality-override/);
    const accepted = await acceptExceptionForClose(client, context, high.id, { reason: 'immaterial, tracked', can: allowAll });
    expect(accepted.status).toBe('ACCEPTED_FOR_CLOSE');
  });
});

/* ── Reopening and re-closing ──────────────────────────────────────────────── */

async function closeJuly(client, data) {
  const context = ctx();
  const { periods } = await seedCalendar(client, context);
  const july = julyOf(periods);
  const run = await beginPeriodClose(client, context, july.id, {});
  await completeChecklist(client, context, run.id);
  const approver = ctx(T1, 'user-2');
  await approveCloseRun(client, approver, run.id, {});
  await closePeriod(client, approver, run.id, {});
  return { context, approver, july, run };
}

describe('period reopening and re-closing', () => {
  it('reopens only through request + impact analysis + second-person approval', async () => {
    const { client, data } = seedBooks();
    const { context, july } = await closeJuly(client, data);

    await expect(requestReopen(client, context, july.id, { reason: 'x' })).rejects.toThrow(/detailed reason/);
    const { request, impact } = await requestReopen(client, context, july.id, {
      reason: 'Omitted material supplier invoice for July',
      expectedCorrections: 'Post supplier bill BILL-072',
    });
    expect(impact.journalsInPeriod).toBeGreaterThanOrEqual(0);
    expect(impact.reportSnapshotsAffected).toHaveLength(5);

    await expect(approveReopen(client, context, request.id, {})).rejects.toThrow(/Separation of duties/);
    const result = await approveReopen(client, ctx(T1, 'user-2'), request.id, { correctionScope: { eventTypes: ['SUPPLIER_BILL_POSTED'] } });
    expect(result.period.status).toBe('REOPENED');
    expect(result.request.status).toBe('EXECUTED');
    expect(data.outbox.some((m) => m.eventType === 'PERIOD_REOPENED')).toBe(true);
    // Original snapshots are preserved.
    expect(data.reportSnapshots).toHaveLength(5);
    const history = await getPeriodStatusHistory(client, context, july.id);
    expect(history.map((h) => h.action)).toEqual(expect.arrayContaining(['REQUEST_REOPEN', 'REOPEN']));
  });

  it('re-closes with a new run version, superseding but preserving the original', async () => {
    const { client, data } = seedBooks();
    const { context, approver, july, run } = await closeJuly(client, data);
    const { request } = await requestReopen(client, context, july.id, { reason: 'Correction required for July payroll' });
    await approveReopen(client, approver, request.id, {});

    const run2 = await beginPeriodClose(client, context, july.id, { reason: 'Re-close after correction' });
    expect(run2.closeNumber).toBe(2);
    await completeChecklist(client, context, run2.id);
    await approveCloseRun(client, approver, run2.id, {});
    const reclosed = await closePeriod(client, approver, run2.id, {});
    expect(reclosed.period.status).toBe('CLOSED');
    // Original run preserved as SUPERSEDED; new run COMPLETED; snapshots doubled.
    expect(data.periodCloseRuns.find((r) => r.id === run.id).status).toBe('SUPERSEDED');
    expect(data.periodCloseRuns.find((r) => r.id === run2.id).status).toBe('COMPLETED');
    expect(data.reportSnapshots.length).toBe(10);
    const history = await getPeriodStatusHistory(client, context, july.id);
    expect(history.map((h) => h.action)).toEqual(expect.arrayContaining(['BEGIN_RECLOSE', 'RECLOSE']));
  });

  it('rejecting a reopening preserves the request with the reason', async () => {
    const { client, data } = seedBooks();
    const { context, july } = await closeJuly(client, data);
    const { request } = await requestReopen(client, context, july.id, { reason: 'Requested correction of rounding' });
    const rejected = await rejectReopen(client, ctx(T1, 'user-2'), request.id, { rejectionReason: 'Immaterial; adjust in current period' });
    expect(rejected.status).toBe('REJECTED');
    expect(data.accountingPeriodsV2.find((p) => p.id === july.id).status).toBe('CLOSED');
  });
});

/* ── Lifecycle guards ──────────────────────────────────────────────────────── */

describe('status transition guards', () => {
  it('refuses illegal transitions (CLOSED → OPEN, DRAFT → CLOSED)', async () => {
    const { client, data } = makeAcctV2PrismaStub();
    const { periods } = await seedCalendar(client);
    const july = data.accountingPeriodsV2.find((p) => p.id === julyOf(periods).id);
    july.status = 'CLOSED';
    await expect(
      client.$transaction((tx) => transitionPeriod(tx, ctx(), july, 'OPEN', 'OPEN', {}))
    ).rejects.toThrow(/not allowed/);
    july.status = 'DRAFT';
    await expect(
      client.$transaction((tx) => transitionPeriod(tx, ctx(), july, 'CLOSED', 'CLOSE', {}))
    ).rejects.toThrow(/not allowed/);
  });

  it('lock-date changes require a reason and write history + audit', async () => {
    const { client, data } = makeAcctV2PrismaStub();
    const { periods } = await seedCalendar(client);
    const julyId = julyOf(periods).id;
    await expect(setPeriodLockDate(client, ctx(), julyId, '2026-07-10', null)).rejects.toThrow(/reason/);
    const updated = await setPeriodLockDate(client, ctx(), julyId, '2026-07-10', 'Prior weeks reviewed');
    expect(isoDate(toDateOnly(updated.lockDate))).toBe('2026-07-10');
    expect(data.periodStatusHistory.some((h) => h.action === 'LOCK_DATE_CHANGED')).toBe(true);
    expect(data.auditLogs.some((a) => a.action === 'acctv2.period.lockDateChange')).toBe(true);
  });
});

/* ── Monitoring and readiness ──────────────────────────────────────────────── */

describe('monitoring and readiness', () => {
  it('flags a missing current period and overdue open periods', async () => {
    const { client } = makeAcctV2PrismaStub();
    await seedCalendar(client);
    const late = await runPeriodMonitoring(client, ctx(), { now: D('2027-03-15T00:00:00Z') });
    const codes = late.findings.map((f) => f.code);
    expect(codes).toContain('MISSING_CURRENT_PERIOD');
    expect(codes).toContain('OPEN_PERIOD_OVERDUE');
    expect(codes).toContain('NEXT_FINANCIAL_YEAR_MISSING');
  });

  it('assesses readiness: READY only with calendar, integrity and mapped journals', async () => {
    const { client, data } = seedBooks();
    await updateCalendarConfig(client, ctx(), { name: 'Configured' });
    const { periods } = await seedCalendar(client);
    // Map every seeded V2 journal to a covering period (date → period).
    for (const je of data.legacyJournalEntries) {
      const d = je.postingDate ?? je.entryDate;
      if (!d || je.accountingPeriodId) continue;
      const period = periods.find((p) => p.startDate <= d && d <= p.endDate);
      if (period) je.accountingPeriodId = period.id;
    }
    const before = await assessPeriodReadiness(client, ctx(), { now: NOW });
    expect(before.status).toBe('READY');
    data.legacyJournalEntries.push({
      id: 'je-x',
      tenantId: T1,
      status: 'Posted',
      entryDate: D('2026-07-02'),
      postingDate: D('2026-07-02'),
      accountingPeriodId: null,
      architectureVersion: 'ACCOUNTING_V2',
    });
    const after = await assessPeriodReadiness(client, ctx(), { now: NOW });
    expect(after.status).toBe('REQUIRES_PERIOD_MAPPING');
  });
});

/* ── Legacy migration ──────────────────────────────────────────────────────── */

describe('legacy period migration', () => {
  const legacySeed = () => makeAcctV2PrismaStub({
    accountingPeriods: [
      { id: 'lp-jun', tenantId: T1, name: 'Jun 2026', periodType: 'Monthly', startDate: D('2026-06-01'), endDate: D('2026-06-30T23:59:59.999Z'), status: 'closed', closedAt: D('2026-07-05'), closedById: 'user-9' },
      { id: 'lp-jul', tenantId: T1, name: 'Jul 2026', periodType: 'Monthly', startDate: D('2026-07-01'), endDate: D('2026-07-31T23:59:59.999Z'), status: 'open' },
      { id: 'lp-fy', tenantId: T1, name: 'FY 2026', periodType: 'Yearly', startDate: D('2026-01-01'), endDate: D('2026-12-31T23:59:59.999Z'), status: 'open' },
    ],
    legacyJournalEntries: [
      { id: 'je-1', tenantId: T1, status: 'Posted', entryDate: D('2026-06-10'), postingDate: null, accountingPeriodId: null, createdAt: D('2026-06-10') },
      { id: 'je-2', tenantId: T1, status: 'Posted', entryDate: D('2026-07-04'), postingDate: D('2026-07-05'), accountingPeriodId: null, createdAt: D('2026-07-05') },
      { id: 'je-nodate', tenantId: T1, status: 'Posted', entryDate: null, postingDate: null, accountingPeriodId: null, createdAt: D('2026-07-06') },
    ],
  });

  it('previews the legacy inventory and proposes canonical years', async () => {
    const { client } = legacySeed();
    const preview = await previewLegacyPeriodMigration(client, ctx(), { now: NOW });
    expect(preview.legacy.monthlyPeriods).toBe(2);
    expect(preview.legacy.closedPeriods).toBe(1);
    expect(preview.journals.unassignedPosted).toBe(3);
    expect(preview.proposal.financialYears.map((y) => y.code)).toContain('FY2026');
  });

  it('executes: creates the canonical calendar, aliases legacy periods, carries closed status and assigns journals from dates only', async () => {
    const { client, data } = legacySeed();
    const result = await executeLegacyPeriodMigration(client, ctx(), { now: NOW });
    expect(result.created.map((c) => c.code)).toContain('FY2026');
    expect(result.closedStatusCarried).toBe(1);
    expect(result.assignedJournals).toBe(2);
    expect(result.unresolved).toEqual([{ journalId: 'je-nodate', reason: 'NO_DATE' }]);

    const june = data.accountingPeriodsV2.find((p) => p.name === 'June 2026');
    expect(june.status).toBe('CLOSED');
    expect(june.legacyPeriodId).toBe('lp-jun');
    const je1 = data.legacyJournalEntries.find((j) => j.id === 'je-1');
    expect(je1.accountingPeriodId).toBe(june.id);
    expect(je1.financialYearLabel).toBe('FY2026');
    // Dates were never modified.
    expect(isoDate(toDateOnly(je1.entryDate))).toBe('2026-06-10');
    // je-2 assigned by POSTING date (2026-07-05), not creation date.
    const je2 = data.legacyJournalEntries.find((j) => j.id === 'je-2');
    const july = data.accountingPeriodsV2.find((p) => p.name === 'July 2026');
    expect(je2.accountingPeriodId).toBe(july.id);
    expect(data.auditLogs.some((a) => a.action === 'acctv2.period.legacyMigration')).toBe(true);
  });

  it('is idempotent on rerun and works on an empty database', async () => {
    const { client, data } = legacySeed();
    await executeLegacyPeriodMigration(client, ctx(), { now: NOW });
    const yearsAfterFirst = data.financialYears.length;
    const again = await executeLegacyPeriodMigration(client, ctx(), { now: NOW });
    expect(again.created).toEqual([]);
    expect(data.financialYears.length).toBe(yearsAfterFirst);

    const empty = makeAcctV2PrismaStub();
    const result = await executeLegacyPeriodMigration(empty.client, ctx(), { now: NOW });
    expect(result.created.map((c) => c.code)).toEqual(['FY2026']);
    expect(result.assignedJournals).toBe(0);
  });
});
