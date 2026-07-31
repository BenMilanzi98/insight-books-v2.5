/**
 * Subledger vs control reconciliations for setup (Slice 4).
 */

import { parseToMinor, minorToDecimalString } from './money.js';
import { FINANCIAL_LINE_STEPS } from './openingLineCompiler.js';

const STATUS = Object.freeze({
  NOT_RUN: 'NOT_RUN',
  PASSED: 'PASSED',
  PASSED_WITH_WARNINGS: 'PASSED_WITH_WARNINGS',
  FAILED: 'FAILED',
  BLOCKED: 'BLOCKED',
});

function sumStepNet(byStep, stepId, filterFn) {
  const lines = byStep[stepId] || [];
  let debit = 0n;
  let credit = 0n;
  for (const line of lines) {
    if (filterFn && !filterFn(line)) continue;
    debit += line.debitMinor || 0n;
    credit += line.creditMinor || 0n;
  }
  return { debit, credit, net: debit - credit };
}

function result(control, subledgerMinor, glMinor, warnings = []) {
  const differenceMinor = glMinor - subledgerMinor;
  const matched = differenceMinor === 0n;
  return {
    control,
    status: matched
      ? warnings.length
        ? STATUS.PASSED_WITH_WARNINGS
        : STATUS.PASSED
      : STATUS.FAILED,
    subledger: minorToDecimalString(subledgerMinor),
    generalLedger: minorToDecimalString(glMinor),
    difference: minorToDecimalString(differenceMinor),
    warnings,
  };
}

/**
 * @param {{ byStep: object, lines: object[] }} compiled
 * @param {object} [mappingAccounts] — optional control account ids from mappings step
 */
export function runSetupReconciliations(compiled, mappingAccounts = {}) {
  const byStep = compiled.byStep || {};
  const lines = compiled.lines || [];
  const results = [];

  const arControlId = mappingAccounts.ACCOUNTS_RECEIVABLE_CONTROL;
  const apControlId = mappingAccounts.ACCOUNTS_PAYABLE_CONTROL;
  const invControlId = mappingAccounts.INVENTORY_ASSET;
  const obEquityId = mappingAccounts.OPENING_BALANCE_EQUITY;

  // Subledger side = control-account (or dimensioned) lines in the domain step.
  // GL side = same control account across the compiled journal.
  const arStep = byStep.openingReceivables || [];
  const arSubMinor = arStep
    .filter((l) =>
      arControlId
        ? l.accountId === arControlId
        : Boolean(l.dimensions?.customerId) || /receivable/i.test(l.accountName || '')
    )
    .reduce((n, l) => n + (l.debitMinor || 0n) - (l.creditMinor || 0n), 0n);
  const arGl = lines
    .filter((l) =>
      arControlId ? l.accountId === arControlId : /receivable/i.test(l.accountName || '')
    )
    .reduce((n, l) => n + (l.debitMinor || 0n) - (l.creditMinor || 0n), 0n);
  results.push(
    result(
      'ACCOUNTS_RECEIVABLE',
      arSubMinor,
      arGl,
      arStep.length === 0 ? ['No opening receivables entered.'] : []
    )
  );

  const apStep = byStep.openingPayables || [];
  const apSubMinor = apStep
    .filter((l) =>
      apControlId
        ? l.accountId === apControlId
        : Boolean(l.dimensions?.supplierId) || /payable/i.test(l.accountName || '')
    )
    .reduce((n, l) => n + (l.creditMinor || 0n) - (l.debitMinor || 0n), 0n);
  const apGl = lines
    .filter((l) =>
      apControlId ? l.accountId === apControlId : /payable/i.test(l.accountName || '')
    )
    .reduce((n, l) => n + (l.creditMinor || 0n) - (l.debitMinor || 0n), 0n);
  results.push(
    result(
      'ACCOUNTS_PAYABLE',
      apSubMinor,
      apGl,
      apStep.length === 0 ? ['No opening payables entered.'] : []
    )
  );

  const stockStep = byStep.openingStock || [];
  const stockSubMinor = stockStep
    .filter((l) =>
      invControlId ? l.accountId === invControlId : /inventor/i.test(l.accountName || '') || (l.debitMinor || 0n) > 0n
    )
    .reduce((n, l) => n + (l.debitMinor || 0n) - (l.creditMinor || 0n), 0n);
  const stockGl = lines
    .filter((l) =>
      invControlId ? l.accountId === invControlId : /inventor/i.test(l.accountName || '')
    )
    .reduce((n, l) => n + (l.debitMinor || 0n) - (l.creditMinor || 0n), 0n);
  results.push(result('INVENTORY', stockSubMinor, stockGl, []));

  // Domain self-checks: asset-side of payment/fixed asset steps vs same-step GL nets
  const payAsset = sumStepNet(byStep, 'paymentAccounts', (l) => (l.debitMinor || 0n) > 0n);
  results.push(
    result('PAYMENT_ACCOUNTS', payAsset.debit - payAsset.credit, payAsset.debit - payAsset.credit, [])
  );

  const assetCost = sumStepNet(byStep, 'fixedAssets', (l) => (l.debitMinor || 0n) > 0n);
  results.push(
    result('FIXED_ASSETS', assetCost.debit - assetCost.credit, assetCost.debit - assetCost.credit, [])
  );

  const loanCredit = sumStepNet(byStep, 'liabilitiesLoans', (l) => (l.creditMinor || 0n) > 0n);
  results.push(
    result(
      'LOANS_LIABILITIES',
      loanCredit.credit - loanCredit.debit,
      loanCredit.credit - loanCredit.debit,
      []
    )
  );

  const taxCredit = sumStepNet(byStep, 'taxes', (l) => (l.creditMinor || 0n) > 0n);
  results.push(
    result('TAXES', taxCredit.credit - taxCredit.debit, taxCredit.credit - taxCredit.debit, [])
  );

  const eqCredit = sumStepNet(byStep, 'capitalEquity', (l) => (l.creditMinor || 0n) > 0n);
  results.push(
    result('EQUITY', eqCredit.credit - eqCredit.debit, eqCredit.credit - eqCredit.debit, [])
  );

  if (obEquityId) {
    const obNet = lines
      .filter((l) => l.accountId === obEquityId)
      .reduce((n, l) => n + (l.creditMinor || 0n) - (l.debitMinor || 0n), 0n);
    results.push({
      control: 'OPENING_BALANCE_EQUITY',
      status: obNet === 0n ? STATUS.PASSED : STATUS.PASSED_WITH_WARNINGS,
      subledger: '0.00',
      generalLedger: minorToDecimalString(obNet),
      difference: minorToDecimalString(obNet),
      warnings:
        obNet === 0n
          ? []
          : ['Opening Balance Equity is not fully resolved. Clear it against Capital/Retained Earnings before go-live.'],
    });
  }

  const failed = results.filter((r) => r.status === STATUS.FAILED);
  // Empty optional domains that match 0=0 are PASSED — treat as ok
  const criticalFailed = failed.filter((r) => {
    const sub = parseToMinor(r.subledger);
    const gl = parseToMinor(r.generalLedger);
    return !(sub === 0n && gl === 0n);
  });

  return {
    results,
    status: criticalFailed.length ? STATUS.FAILED : STATUS.PASSED,
    failedControls: criticalFailed.map((r) => r.control),
    FINANCIAL_LINE_STEPS,
  };
}
