/**
 * Compile Setup Run step payloads into one consolidated Opening Journal line set (B1).
 */

import prisma from '../prisma.js';
import { normalizeDebitCredit, sumDebitCredit, minorToDecimalString } from './money.js';

/** Steps that contribute GL lines to the opening journal. */
export const FINANCIAL_LINE_STEPS = Object.freeze([
  'paymentAccounts',
  'openingReceivables',
  'openingPayables',
  'openingStock',
  'fixedAssets',
  'otherAssets',
  'liabilitiesLoans',
  'taxes',
  'capitalEquity',
  'manualBalances',
]);

/**
 * Extract raw lines from a step payload.
 * Supports:
 *  - payload.lines: [{ accountId, debit, credit, description, customerId, supplierId }]
 *  - payload.items: same shape (alias)
 *  - payload.entries with amount + side ('debit'|'credit')
 *
 * @param {object} payload
 * @param {string} stepId
 */
export function extractLinesFromPayload(payload, stepId) {
  if (!payload || typeof payload !== 'object') return [];
  const raw = Array.isArray(payload.lines)
    ? payload.lines
    : Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(payload.entries)
        ? payload.entries
        : [];

  const out = [];
  for (let i = 0; i < raw.length; i += 1) {
    const row = raw[i] || {};
    if (!row.accountId) continue;

    let debit = row.debit;
    let credit = row.credit;
    if ((debit == null || debit === '') && (credit == null || credit === '') && row.amount != null) {
      const side = String(row.side || row.balanceType || 'debit').toLowerCase();
      if (side === 'credit') credit = row.amount;
      else debit = row.amount;
    }

    const norm = normalizeDebitCredit(debit, credit);
    if (norm.debitMinor === 0n && norm.creditMinor === 0n) continue;

    out.push({
      accountId: String(row.accountId),
      debit: norm.debit,
      credit: norm.credit,
      debitMinor: norm.debitMinor,
      creditMinor: norm.creditMinor,
      description: row.description || `${stepId} opening`,
      dimensions: {
        ...(row.customerId ? { customerId: row.customerId } : {}),
        ...(row.supplierId ? { supplierId: row.supplierId } : {}),
        ...(row.productId ? { productId: row.productId } : {}),
      },
      sourceStepId: stepId,
      sourceIndex: i,
      legacyReference: row.legacyReference || row.reference || null,
    });
  }
  return out;
}

/**
 * @param {object} run — Setup run with steps
 * @param {object} [options]
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function compileOpeningLines(run, options = {}, db = prisma) {
  const steps = run.steps || [];
  const compiled = [];
  const byStep = {};

  for (const stepId of FINANCIAL_LINE_STEPS) {
    const step = steps.find((s) => s.stepId === stepId);
    const lines = extractLinesFromPayload(step?.payload, stepId);
    byStep[stepId] = lines;
    compiled.push(...lines);
  }

  const totals = sumDebitCredit(compiled);
  const accountIds = [...new Set(compiled.map((l) => l.accountId))];
  const accounts = accountIds.length
    ? await db.account.findMany({
        where: { tenantId: run.tenantId, id: { in: accountIds } },
        select: {
          id: true,
          tenantId: true,
          accountCode: true,
          code: true,
          accountName: true,
          name: true,
          accountType: true,
          type: true,
          isActive: true,
          acceptsNewTransactions: true,
          coaV2Behaviour: true,
        },
      })
    : [];
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  const issues = [];
  for (const line of compiled) {
    const acct = accountMap.get(line.accountId);
    if (!acct) {
      issues.push({
        severity: 'CRITICAL',
        code: 'UNKNOWN_ACCOUNT',
        message: `Account ${line.accountId} not found in this business.`,
        stepId: line.sourceStepId,
      });
      continue;
    }
    if (acct.tenantId && acct.tenantId !== run.tenantId) {
      issues.push({
        severity: 'CRITICAL',
        code: 'CROSS_BUSINESS_ACCOUNT',
        message: 'Account belongs to another business.',
        stepId: line.sourceStepId,
      });
    }
    if (acct.isActive === false) {
      issues.push({
        severity: 'HIGH',
        code: 'INACTIVE_ACCOUNT',
        message: `Account ${acct.accountCode || acct.code} is inactive.`,
        stepId: line.sourceStepId,
      });
    }
    if (
      acct.acceptsNewTransactions === false ||
      String(acct.coaV2Behaviour || '').toUpperCase() === 'HEADER'
    ) {
      issues.push({
        severity: 'CRITICAL',
        code: 'HEADER_ACCOUNT',
        message: `Account ${acct.accountCode || acct.code} cannot accept postings.`,
        stepId: line.sourceStepId,
      });
    }
    line.accountCode = acct.accountCode || acct.code;
    line.accountName = acct.accountName || acct.name;
    line.accountType = acct.accountType || acct.type;
  }

  if (!totals.balanced) {
    issues.push({
      severity: 'CRITICAL',
      code: 'TRIAL_BALANCE_OUT_OF_BALANCE',
      message: `Debits ${totals.debit} do not equal credits ${totals.credit} (difference ${totals.difference}).`,
    });
  }

  if (compiled.length > 0 && compiled.length < 2 && options.requireMinLines !== false) {
    issues.push({
      severity: 'CRITICAL',
      code: 'INSUFFICIENT_LINES',
      message: 'Opening journal requires at least two lines.',
    });
  }

  const journalLines = compiled.map((l) => ({
    accountId: l.accountId,
    debit: l.debit,
    credit: l.credit,
    description: l.description,
    dimensions: l.dimensions,
  }));

  return {
    lines: compiled,
    journalLines,
    byStep,
    totals,
    issues,
    accountMap,
  };
}

/**
 * Build Assets / Liabilities / Equity buckets from compiled lines (signed by normal presentation).
 */
export function computeBalanceSheetEquation(compiledLines) {
  let assets = 0n;
  let liabilities = 0n;
  let equity = 0n;

  for (const line of compiledLines) {
    const type = String(line.accountType || '').toLowerCase();
    const net = (line.debitMinor || 0n) - (line.creditMinor || 0n);
    if (type.includes('asset')) {
      assets += net;
    } else if (type.includes('liabilit')) {
      liabilities += -net; // credit increases liability
    } else if (type.includes('equity') || type.includes('capital')) {
      equity += -net;
    } else if (type.includes('revenue') || type.includes('income')) {
      // Opening should not use these — still count toward equity-like for equation visibility
      equity += -net;
    } else if (type.includes('expense') || type.includes('cost')) {
      equity += -net;
    }
  }

  const difference = assets - liabilities - equity;
  return {
    totalAssets: minorToDecimalString(assets),
    totalLiabilities: minorToDecimalString(liabilities),
    totalEquity: minorToDecimalString(equity),
    difference: minorToDecimalString(difference),
    assetsMinor: assets,
    liabilitiesMinor: liabilities,
    equityMinor: equity,
    differenceMinor: difference,
    balanced: difference === 0n,
  };
}

export function emptyCompileResult() {
  return {
    lines: [],
    journalLines: [],
    byStep: {},
    totals: sumDebitCredit([]),
    issues: [],
    accountMap: new Map(),
  };
}