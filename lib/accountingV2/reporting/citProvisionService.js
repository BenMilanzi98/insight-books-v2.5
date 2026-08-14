/**
 * Corporate Income Tax (CIT) provision for Profit & Loss.
 *
 * Accrual P&L Apply upserts an idempotent CitProvision journal
 * (Dr Corporate Tax Expense 5580 / Cr CIT payable from tax management).
 * Cash-basis runs compute display amounts only — no ledger post.
 */

import { fromMinor } from '../../money.js';
import { assertPeriodOpen } from '../../accountingPeriodService.js';
import { MALAWI_CORPORATE_TAX_RATE } from '../../malawiTaxCatalog.js';
import { postTaxSettlementAccounting } from '../adapters/remainingAdapters.js';
import { reverseSourceJournals } from '../application/reverseSourceJournals.js';

export const CIT_SOURCE_TYPE = 'CitProvision';
export const CIT_EXPENSE_CODE = '5580';

/** @param {Date|string|null|undefined} d */
export function toIsoDateOnly(d) {
  if (!d) return null;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return x.toISOString().slice(0, 10);
}

/** Stable period key for CitProvision sourceId. */
export function buildCitPeriodKey(fromDate, toDate) {
  const from = toIsoDateOnly(fromDate);
  const to = toIsoDateOnly(toDate);
  if (!from || !to) throw new Error('CIT period requires fromDate and toDate');
  return `${from}_${to}`;
}

export function buildCitSourceId(periodKey, generation = 1) {
  const base = `cit:${periodKey}`;
  return generation <= 1 ? base : `${base}:v${generation}`;
}

/**
 * @param {number} npbtMinor debit-positive P&L minor units for Net Profit Before Tax
 * @param {number} ratePercent e.g. 30
 */
export function computeCitProvisionMinor(npbtMinor, ratePercent) {
  const npbt = Number(npbtMinor) || 0;
  const rate = Number(ratePercent);
  if (!(npbt > 0) || !Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round((npbt * rate) / 100);
}

/**
 * Resolve enabled Corporate Income Tax from tax management.
 * Enablement is current status only — rate applies to the whole report period
 * (including activity before the tax was turned on).
 * @returns {Promise<{ taxType: object, ratePercent: number }|null>}
 */
export async function resolveEnabledCitTax(db, tenantId) {
  if (!db?.taxType?.findFirst || !tenantId) return null;
  const candidates = await db.taxType.findMany({
    where: {
      tenantId,
      OR: [
        { taxId: 'MW-CIT' },
        { taxCode: 'MW-CIT' },
        { taxName: { equals: 'Corporate Income Tax', mode: 'insensitive' } },
        { taxName: { contains: 'Corporate Income Tax', mode: 'insensitive' } },
      ],
    },
    include: { account: true },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });
  const taxType = candidates.find((t) => String(t.status || '').toLowerCase() === 'active');
  if (!taxType) return null;
  const rate =
    Number.isFinite(Number(taxType.taxRate)) && Number(taxType.taxRate) > 0
      ? Number(taxType.taxRate)
      : MALAWI_CORPORATE_TAX_RATE;
  return { taxType, ratePercent: rate };
}

async function resolveCitExpenseAccount(db, tenantId) {
  const byCode = await db.account.findFirst({
    where: { tenantId, accountCode: CIT_EXPENSE_CODE, isActive: true },
    select: { id: true, accountCode: true, accountName: true },
  });
  if (byCode) return byCode;
  return db.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { accountName: { equals: 'Corporate Tax Expense', mode: 'insensitive' } },
        { accountName: { contains: 'Corporate Income Tax Expense', mode: 'insensitive' } },
      ],
    },
    select: { id: true, accountCode: true, accountName: true },
  });
}

function journalCitMinor(journal) {
  const lines = journal.lines || [];
  let debit = 0;
  for (const line of lines) {
    debit += Number(line.debitAmount ?? line.debit ?? 0);
  }
  // Journal amounts are major units (decimal currency); convert to minor.
  return Math.round(debit * 100);
}

/**
 * Latest unreversed Posted CitProvision journal for a period key.
 */
export async function findActiveCitProvisionJournal(db, tenantId, periodKey) {
  const base = buildCitSourceId(periodKey, 1);
  const rows = await db.journalEntry.findMany({
    where: {
      tenantId,
      architectureVersion: 'ACCOUNTING_V2',
      status: 'Posted',
      sourceType: CIT_SOURCE_TYPE,
      OR: [{ sourceId: base }, { sourceId: { startsWith: `${base}:v` } }],
      reversedByJournalId: null,
    },
    include: { lines: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  return rows[0] || null;
}

/**
 * Ensure CIT provision for an accrual P&L period.
 *
 * @returns {Promise<object>} status payload for report meta / warnings
 */
export async function ensureCitProvisionForPeriod({
  db,
  tenantId,
  userId,
  fromDate,
  toDate,
  npbtMinor,
  reportBasis = 'ACCRUAL',
  branchId = null,
  currency = 'MWK',
  apply = true,
  hasPermission = () => true,
}) {
  const periodKey = buildCitPeriodKey(fromDate, toDate);
  const resolved = await resolveEnabledCitTax(db, tenantId);
  if (!resolved) {
    return {
      posted: false,
      reason: 'CIT_NOT_ENABLED',
      citMinor: 0,
      ratePercent: 0,
      periodKey,
      warning: 'Corporate Income Tax is not enabled in tax management — tax line is 0.',
    };
  }

  const { taxType, ratePercent } = resolved;
  const citMinor = computeCitProvisionMinor(npbtMinor, ratePercent);

  if (reportBasis === 'CASH' || !apply) {
    return {
      posted: false,
      reason: reportBasis === 'CASH' ? 'CASH_BASIS' : 'DISPLAY_ONLY',
      citMinor,
      ratePercent,
      periodKey,
      taxTypeId: taxType.id,
    };
  }

  if (citMinor <= 0) {
    const existing = await findActiveCitProvisionJournal(db, tenantId, periodKey);
    if (existing) {
      try {
        await reverseSourceJournals({
          tenantId,
          userId,
          reason: 'CIT provision cleared (NPBT ≤ 0)',
          sourceTypes: CIT_SOURCE_TYPE,
          sourceIdCandidates: [existing.sourceId],
          requireJournals: false,
          expandIds: false,
          postingDate: toIsoDateOnly(toDate),
          hasPermission,
          approvalOverride: {
            allowSelfApproval: true,
            approvedById: userId,
            approvedAt: new Date().toISOString(),
            createdById: userId,
          },
          db,
        });
      } catch (err) {
        return {
          posted: false,
          reason: 'REVERSE_FAILED',
          citMinor: 0,
          ratePercent,
          periodKey,
          warning: err?.message || 'Failed to reverse prior CIT provision',
        };
      }
    }
    return { posted: false, reason: 'ZERO_OR_LOSS', citMinor: 0, ratePercent, periodKey };
  }

  try {
    await assertPeriodOpen(tenantId, toDate instanceof Date ? toDate : new Date(toDate), db);
  } catch (err) {
    return {
      posted: false,
      reason: err?.code || 'PERIOD_CLOSED',
      citMinor,
      ratePercent,
      periodKey,
      warning: 'Period closed — CIT not posted; amount shown is calculated only.',
    };
  }

  const expenseAccount = await resolveCitExpenseAccount(db, tenantId);
  const payableAccountId = taxType.accountId;
  if (!expenseAccount?.id || !payableAccountId) {
    return {
      posted: false,
      reason: 'CIT_GL_MISSING',
      citMinor,
      ratePercent,
      periodKey,
      warning:
        'CIT is enabled but Corporate Tax Expense (5580) or tax payable GL is missing — not posted.',
    };
  }

  const existing = await findActiveCitProvisionJournal(db, tenantId, periodKey);
  if (existing && journalCitMinor(existing) === citMinor) {
    return {
      posted: false,
      reason: 'UNCHANGED',
      citMinor,
      ratePercent,
      periodKey,
      journalId: existing.id,
      sourceId: existing.sourceId,
    };
  }

  if (existing) {
    try {
      await reverseSourceJournals({
        tenantId,
        userId,
        reason: 'Replace CIT provision for updated NPBT',
        sourceTypes: CIT_SOURCE_TYPE,
        sourceIdCandidates: [existing.sourceId],
        requireJournals: false,
        expandIds: false,
        postingDate: toIsoDateOnly(toDate),
        hasPermission,
        approvalOverride: {
          allowSelfApproval: true,
          approvedById: userId,
          approvedAt: new Date().toISOString(),
          createdById: userId,
        },
        db,
      });
    } catch (err) {
      return {
        posted: false,
        reason: 'REVERSE_FAILED',
        citMinor,
        ratePercent,
        periodKey,
        warning: err?.message || 'Failed to reverse prior CIT provision',
      };
    }
  }

  const generation = existing ? Date.now() : 1;
  const sourceId = buildCitSourceId(periodKey, generation === 1 ? 1 : generation);
  const decimal = fromMinor(citMinor);
  const description = `Corporate Income Tax provision ${toIsoDateOnly(fromDate)} – ${toIsoDateOnly(toDate)} (${ratePercent}%)`;

  try {
    const outcome = await postTaxSettlementAccounting({
      db,
      tenantId,
      userId,
      sourceId,
      sourceType: CIT_SOURCE_TYPE,
      amount: decimal,
      date: toDate,
      description,
      currency,
      hasPermission,
      lines: [
        {
          accountId: expenseAccount.id,
          debitAmount: Number(decimal),
          creditAmount: 0,
          description,
          lineNumber: 1,
          ...(branchId ? { dimensions: { branchId } } : {}),
        },
        {
          accountId: payableAccountId,
          debitAmount: 0,
          creditAmount: Number(decimal),
          description,
          lineNumber: 2,
          ...(branchId ? { dimensions: { branchId } } : {}),
        },
      ],
    });

    return {
      posted: true,
      reason: existing ? 'REPLACED' : 'POSTED',
      citMinor,
      ratePercent,
      periodKey,
      sourceId,
      journalId: outcome?.result?.journalEntryId ?? null,
      taxTypeId: taxType.id,
    };
  } catch (err) {
    return {
      posted: false,
      reason: 'POST_FAILED',
      citMinor,
      ratePercent,
      periodKey,
      warning: err?.message || 'CIT provision posting failed',
    };
  }
}

/**
 * Apply calculated CIT to statement body minors (cash display / closed-period /
 * missing GL / post-failure fallback). Always forces the tax line to the
 * provision for the selected period so historical NPBT is taxed once CIT is Active.
 */
export function applyCitDisplayToBody(body, citMinor) {
  if (!body?.lineMinors) return body;
  const npbt = body.lineMinors.get('profit-before-tax') ?? 0;
  const tax = Math.max(0, Number(citMinor) || 0);
  body.lineMinors.set('tax-expense', tax);
  body.lineMinors.set('net-profit', npbt - tax);
  return body;
}

/** True when the statement should show calculated CIT (not only when posted). */
export function shouldShowCalculatedCit(citMeta) {
  if (!citMeta) return false;
  if (citMeta.reason === 'CIT_NOT_ENABLED') return false;
  return Number(citMeta.citMinor) > 0 || citMeta.reason === 'ZERO_OR_LOSS';
}
