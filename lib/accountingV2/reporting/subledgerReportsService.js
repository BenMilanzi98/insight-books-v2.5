/**
 * Phase 7 — subledger and module financial reports.
 *
 * Receivables/Payables aging (operational documents provide the AGING DETAIL —
 * expressly permitted by §35/§36 — while the TOTAL reconciles to the control
 * account's canonical GL balance), plus GL control-group reports for
 * inventory, fixed assets, payroll, loans, taxes and equity, and the Budget
 * versus Actual foundation (actuals from GL only; budget rows never post).
 */

import { getBusinessLedgerSummary } from '../ledger/ledgerQueryService.js';
import { resolveAccountProfile } from './reportDefinitions.js';
import {
  buildReportEnvelope,
  buildReportLine,
  amount,
  REPORT_INTEGRITY_STATUS,
} from './reportContracts.js';
import { parseDecimalToMinor } from '../domain/money.js';
import { loadOpenAccountingExceptions } from './trialBalanceService.js';

const AGING_BUCKETS = Object.freeze([
  { key: 'current', label: 'Current', from: -Infinity, to: 0 },
  { key: 'd1_30', label: '1–30 days', from: 1, to: 30 },
  { key: 'd31_60', label: '31–60 days', from: 31, to: 60 },
  { key: 'd61_90', label: '61–90 days', from: 61, to: 90 },
  { key: 'd91_120', label: '91–120 days', from: 91, to: 120 },
  { key: 'd120_plus', label: '120+ days', from: 121, to: Infinity },
]);

const bucketFor = (daysOverdue) =>
  AGING_BUCKETS.find((b) => daysOverdue >= b.from && daysOverdue <= b.to) ?? AGING_BUCKETS[0];

const dayDiff = (asOf, due) => Math.floor((asOf.getTime() - new Date(due).getTime()) / 86400000);

const safeMinor = (value) => {
  try {
    return parseDecimalToMinor(value ?? 0);
  } catch {
    return 0;
  }
};

async function closingForProfiles(db, context, request, predicate) {
  const summary = await getBusinessLedgerSummary(db, context, {
    endDate: request.asOfDate ?? request.toDate ?? undefined,
    branchId: request.branchId ?? null,
    includeZeroActivity: false,
  });
  const rows = [];
  let signedTotal = 0;
  for (const r of summary.accounts) {
    if (r.isHeader) continue;
    const profile = resolveAccountProfile(r);
    if (!predicate(profile, r)) continue;
    rows.push({ row: r, profile });
    signedTotal += r.closing.signedMinor;
  }
  return { rows, signedTotal, summary };
}

function reconciliationStatus(differenceMinor, envelope) {
  if (differenceMinor !== 0) {
    envelope.integrityWarnings.push({
      code: envelope.reportType === 'RECEIVABLES' ? 'REP-006' : 'REP-007',
      message: `Subledger total differs from the control account by ${differenceMinor} minor units; difference disclosed, not hidden.`,
      differenceMinor,
      origin: 'CURRENT_SYSTEM',
    });
    envelope.integrityStatus = REPORT_INTEGRITY_STATUS.UNVERIFIED;
  } else if (envelope.integrityWarnings.length > 0 || envelope.unresolvedExceptions.length > 0) {
    envelope.integrityStatus = REPORT_INTEGRITY_STATUS.VERIFIED_WITH_WARNINGS;
  } else {
    envelope.integrityStatus = REPORT_INTEGRITY_STATUS.VERIFIED;
  }
  return envelope;
}

/* ── Receivables aging (§35) ──────────────────────────────────────────────── */

export async function generateReceivablesReport(db, context, request) {
  const asOf = request.asOfDate ?? request.toDate ?? new Date();
  const [control, exceptions, invoices] = await Promise.all([
    closingForProfiles(db, context, request, (p) =>
      p.category === 'ASSET' &&
      (p.subType === 'ACCOUNTS_RECEIVABLE' || p.subType === 'RECEIVABLE' ||
        p.purpose === 'ACCOUNTS_RECEIVABLE' || p.controlPurpose === 'ACCOUNTS_RECEIVABLE' ||
        (!p.subType && !p.purpose && p.assist.receivable))
    ),
    loadOpenAccountingExceptions(db, context),
    db.invoice.findMany({
      where: {
        tenantId: context.businessId,
        isDeleted: false,
        status: { notIn: ['draft', 'void', 'voided', 'cancelled'] },
        issueDate: { lte: asOf },
      },
    }),
  ]);

  const buckets = new Map(AGING_BUCKETS.map((b) => [b.key, { ...b, minor: 0, count: 0 }]));
  const detail = [];
  let subledgerMinor = 0;
  for (const inv of invoices) {
    const outstanding = safeMinor(inv.remainingBalance ?? inv.total);
    if (outstanding <= 0) continue;
    const bucket = bucketFor(dayDiff(asOf, inv.dueDate));
    buckets.get(bucket.key).minor += outstanding;
    buckets.get(bucket.key).count += 1;
    subledgerMinor += outstanding;
    detail.push({
      documentId: inv.id,
      documentNumber: inv.invoiceNumber,
      customerId: inv.clientId,
      dueDate: new Date(inv.dueDate).toISOString(),
      outstanding: amount(outstanding),
      bucket: bucket.key,
    });
  }

  const controlMinor = control.signedTotal; // AR is debit-normal: signed = balance
  const differenceMinor = subledgerMinor - controlMinor;

  const lines = [
    ...[...buckets.values()].map((b, i) =>
      buildReportLine({
        lineId: `bucket-${b.key}`,
        label: b.label,
        lineType: 'ACCOUNT_GROUP',
        displayOrder: 10 + i,
        currentMinor: b.minor,
        metadata: { documentCount: b.count },
      })
    ),
    buildReportLine({ lineId: 'subledger-total', label: 'Customer Subledger Total', lineType: 'GRAND_TOTAL', displayOrder: 20, currentMinor: subledgerMinor }),
    buildReportLine({
      lineId: 'control-account',
      label: 'Accounts Receivable Control (General Ledger)',
      lineType: 'CALCULATED_TOTAL',
      displayOrder: 21,
      currentMinor: controlMinor,
      accounts: control.rows.map(({ row }) => ({
        accountId: row.accountId,
        accountCode: row.accountCode,
        accountName: row.accountName,
        amount: amount(row.closing.signedMinor),
        lineCount: row.lineCount,
      })),
    }),
    buildReportLine({ lineId: 'difference', label: 'Difference (subledger − control)', lineType: 'VARIANCE', displayOrder: 22, currentMinor: differenceMinor, warningStatus: differenceMinor !== 0 ? 'CONTROL_DIFFERENCE' : null }),
  ];

  const envelope = buildReportEnvelope(context, request, { id: 'AR-AGING', name: 'Receivables Aging', version: '1.0.0' }, {
    drillDownBasis: 'AS_OF',
    lines,
    detail,
    totals: {
      subledger: amount(subledgerMinor),
      controlAccount: amount(controlMinor),
      difference: amount(differenceMinor),
      reconciles: differenceMinor === 0,
    },
    unresolvedExceptions: exceptions,
  });
  return reconciliationStatus(differenceMinor, envelope);
}

/* ── Payables aging (§36) ─────────────────────────────────────────────────── */

export async function generatePayablesReport(db, context, request) {
  const asOf = request.asOfDate ?? request.toDate ?? new Date();
  const [control, exceptions, bills] = await Promise.all([
    closingForProfiles(db, context, request, (p) =>
      p.category === 'LIABILITY' &&
      (p.subType === 'ACCOUNTS_PAYABLE' || p.subType === 'PAYABLE' ||
        p.purpose === 'ACCOUNTS_PAYABLE' || p.controlPurpose === 'ACCOUNTS_PAYABLE' ||
        (!p.subType && !p.purpose && p.assist.payable))
    ),
    loadOpenAccountingExceptions(db, context),
    db.supplierBill
      ? db.supplierBill.findMany({
          where: {
            tenantId: context.businessId,
            status: { notIn: ['Draft', 'draft', 'Cancelled', 'cancelled', 'void'] },
            billDate: { lte: asOf },
          },
        })
      : Promise.resolve([]),
  ]);

  const buckets = new Map(AGING_BUCKETS.map((b) => [b.key, { ...b, minor: 0, count: 0 }]));
  const detail = [];
  let subledgerMinor = 0;
  for (const bill of bills) {
    const outstanding = safeMinor(bill.totalAmount) - safeMinor(bill.amountPaid);
    if (outstanding <= 0) continue;
    const bucket = bucketFor(dayDiff(asOf, bill.dueDate));
    buckets.get(bucket.key).minor += outstanding;
    buckets.get(bucket.key).count += 1;
    subledgerMinor += outstanding;
    detail.push({
      documentId: bill.id,
      documentNumber: bill.billNumber,
      supplierId: bill.supplierId,
      dueDate: new Date(bill.dueDate).toISOString(),
      outstanding: amount(outstanding),
      bucket: bucket.key,
    });
  }

  const controlMinor = -control.signedTotal; // AP is credit-normal
  const differenceMinor = subledgerMinor - controlMinor;

  const lines = [
    ...[...buckets.values()].map((b, i) =>
      buildReportLine({
        lineId: `bucket-${b.key}`,
        label: b.label,
        lineType: 'ACCOUNT_GROUP',
        displayOrder: 10 + i,
        currentMinor: b.minor,
        metadata: { documentCount: b.count },
      })
    ),
    buildReportLine({ lineId: 'subledger-total', label: 'Supplier Subledger Total', lineType: 'GRAND_TOTAL', displayOrder: 20, currentMinor: subledgerMinor }),
    buildReportLine({
      lineId: 'control-account',
      label: 'Accounts Payable Control (General Ledger)',
      lineType: 'CALCULATED_TOTAL',
      displayOrder: 21,
      currentMinor: controlMinor,
      accounts: control.rows.map(({ row }) => ({
        accountId: row.accountId,
        accountCode: row.accountCode,
        accountName: row.accountName,
        amount: amount(-row.closing.signedMinor),
        lineCount: row.lineCount,
      })),
      displaySign: -1,
    }),
    buildReportLine({ lineId: 'difference', label: 'Difference (subledger − control)', lineType: 'VARIANCE', displayOrder: 22, currentMinor: differenceMinor, warningStatus: differenceMinor !== 0 ? 'CONTROL_DIFFERENCE' : null }),
  ];

  const envelope = buildReportEnvelope(context, request, { id: 'AP-AGING', name: 'Payables Aging', version: '1.0.0' }, {
    drillDownBasis: 'AS_OF',
    lines,
    detail,
    totals: {
      subledger: amount(subledgerMinor),
      controlAccount: amount(controlMinor),
      difference: amount(differenceMinor),
      reconciles: differenceMinor === 0,
    },
    unresolvedExceptions: exceptions,
  });
  return reconciliationStatus(differenceMinor, envelope);
}

/* ── GL control-group reports (§37–41 + equity) ──────────────────────────── */

const MODULE_GROUPS = Object.freeze({
  INVENTORY: {
    name: 'Inventory Financial Report',
    creditNormal: false,
    predicate: (p) =>
      p.category === 'ASSET' &&
      (p.subType === 'INVENTORY' || p.purpose === 'INVENTORY' || p.controlPurpose === 'INVENTORY' ||
        (!p.subType && !p.purpose && p.assist.inventory)),
  },
  FIXED_ASSETS: {
    name: 'Fixed Asset Financial Report',
    creditNormal: false,
    predicate: (p) =>
      p.category === 'ASSET' &&
      (['FIXED_ASSET', 'PROPERTY_PLANT_EQUIPMENT', 'PPE', 'ACCUMULATED_DEPRECIATION', 'INTANGIBLE', 'INVESTMENT', 'NON_CURRENT_ASSET'].includes(p.subType) ||
        (!p.subType && (p.assist.fixedAsset || p.assist.accumulatedDepreciation))),
  },
  PAYROLL: {
    name: 'Payroll Financial Report',
    creditNormal: false, // mixed: expense (debit) + liabilities (credit), presented signed
    predicate: (p) =>
      (p.category === 'EXPENSE' && (p.subType === 'SALARIES' || (!p.subType && p.assist.salaries))) ||
      (p.category === 'LIABILITY' &&
        (['PAYROLL_LIABILITY', 'PENSION_PAYABLE'].includes(p.subType) ||
          ['PAYROLL_PAYABLE', 'PENSION_PAYABLE', 'PAYE_PAYABLE'].includes(p.purpose) ||
          (!p.subType && !p.purpose && p.assist.payrollLiability))),
  },
  LOANS: {
    name: 'Loan Financial Report',
    creditNormal: true,
    predicate: (p) =>
      (p.category === 'LIABILITY' &&
        (['LOAN', 'LONG_TERM_LOAN', 'CURRENT_LOAN', 'BORROWING', 'LEASE_LIABILITY'].includes(p.subType) ||
          p.purpose === 'LOAN_PAYABLE' || (!p.subType && p.assist.loan))) ||
      (p.category === 'EXPENSE' && (p.subType === 'FINANCE_COST' || p.subType === 'INTEREST' || (!p.subType && p.assist.interest))),
  },
  TAXES: {
    name: 'Tax Financial Report',
    creditNormal: true,
    predicate: (p) =>
      (p.category === 'LIABILITY' &&
        (['TAX_LIABILITY', 'VAT', 'PAYE', 'WITHHOLDING_TAX'].includes(p.subType) ||
          ['VAT_PAYABLE', 'PAYE_PAYABLE', 'TAX'].includes(p.purpose) ||
          (!p.subType && !p.purpose && p.assist.taxLiability))) ||
      (p.category === 'EXPENSE' && (['TAX', 'INCOME_TAX'].includes(p.subType) || (!p.subType && p.assist.taxExpense))),
  },
  EQUITY: {
    name: 'Equity Report',
    creditNormal: true,
    predicate: (p) => p.category === 'EQUITY',
  },
});

/**
 * Generic module report: the module's GL accounts with opening / movement /
 * closing (canonical), presented per the module's normal balance. Financial
 * totals ARE the GL accounts — reconciliation to operational registers is a
 * supporting schedule, never an alternative accounting total.
 */
export async function generateModuleReport(db, context, request, moduleKey) {
  const group = MODULE_GROUPS[moduleKey];
  if (!group) throw new Error(`Unknown module report: ${moduleKey}`);
  const summary = await getBusinessLedgerSummary(db, context, {
    startDate: request.fromDate ?? undefined,
    endDate: request.toDate ?? request.asOfDate ?? undefined,
    branchId: request.branchId ?? null,
    includeZeroActivity: request.includeZeroBalances,
  });
  const exceptions = await loadOpenAccountingExceptions(db, context);
  const sign = group.creditNormal ? -1 : 1;
  const rows = [];
  let openingTotal = 0;
  let movementTotal = 0;
  let closingTotal = 0;
  for (const r of summary.accounts) {
    if (r.isHeader) continue;
    const profile = resolveAccountProfile(r);
    if (!group.predicate(profile)) continue;
    const opening = sign * r.opening.signedMinor;
    const movement = sign * (r.periodDebitMinor - r.periodCreditMinor);
    const closing = sign * r.closing.signedMinor;
    openingTotal += opening;
    movementTotal += movement;
    closingTotal += closing;
    rows.push(
      buildReportLine({
        lineId: `acct-${r.accountId}`,
        code: r.accountCode,
        label: r.accountName ?? r.accountCode ?? r.accountId,
        lineType: 'ACCOUNT',
        displayOrder: rows.length + 10,
        currentMinor: closing,
        accounts: [{ accountId: r.accountId, accountCode: r.accountCode, accountName: r.accountName, amount: amount(closing), lineCount: r.lineCount }],
        normalBalance: r.normalBalance,
        displaySign: sign,
        metadata: { opening: amount(opening), movement: amount(movement) },
      })
    );
  }
  rows.push(
    buildReportLine({ lineId: 'total', label: `${group.name} Total`, lineType: 'GRAND_TOTAL', displayOrder: 1000, currentMinor: closingTotal })
  );

  const envelope = buildReportEnvelope(context, request, { id: `MOD-${moduleKey}`, name: group.name, version: '1.0.0' }, {
    drillDownBasis: 'AS_OF',
    lines: rows,
    totals: { opening: amount(openingTotal), movement: amount(movementTotal), closing: amount(closingTotal) },
    unresolvedExceptions: exceptions,
  });
  envelope.integrityStatus =
    envelope.integrityWarnings.length > 0 || exceptions.length > 0
      ? REPORT_INTEGRITY_STATUS.VERIFIED_WITH_WARNINGS
      : REPORT_INTEGRITY_STATUS.VERIFIED;
  return envelope;
}

/* ── Budget versus Actual foundation (§42) ────────────────────────────────── */

export async function generateBudgetVsActual(db, context, request) {
  const summary = await getBusinessLedgerSummary(db, context, {
    startDate: request.fromDate ?? undefined,
    endDate: request.toDate ?? undefined,
    branchId: request.branchId ?? null,
    includeZeroActivity: false,
  });
  const budgetItems = db.legacyBudgetItem
    ? await db.legacyBudgetItem.findMany({
        where: {
          period: {
            gte: request.fromDate ?? new Date(0),
            lte: request.toDate ?? new Date(),
          },
          ...(request.branchId ? { branchId: request.branchId } : {}),
          legacyBudget: { tenantId: context.businessId, status: { in: ['active', 'approved', 'closed'] } },
        },
      })
    : [];

  const actualByAccount = new Map();
  for (const r of summary.accounts) {
    if (r.isHeader) continue;
    const profile = resolveAccountProfile(r);
    const sign = ['REVENUE', 'OTHER_INCOME'].includes(profile.category) ? -1 : 1;
    actualByAccount.set(r.accountId, {
      row: r,
      actualMinor: sign * (r.periodDebitMinor - r.periodCreditMinor),
    });
  }

  const budgetByAccount = new Map();
  for (const item of budgetItems) {
    if (!item.accountId) continue;
    budgetByAccount.set(
      item.accountId,
      (budgetByAccount.get(item.accountId) ?? 0) + safeMinor(item.budgetedAmount)
    );
  }

  const lines = [];
  for (const [accountId, budgetMinor] of budgetByAccount) {
    const actual = actualByAccount.get(accountId);
    const actualMinor = actual?.actualMinor ?? 0;
    lines.push(
      buildReportLine({
        lineId: `bva-${accountId}`,
        code: actual?.row.accountCode ?? null,
        label: actual?.row.accountName ?? accountId,
        lineType: 'ACCOUNT',
        displayOrder: lines.length + 10,
        currentMinor: actualMinor,
        budgetMinor,
        accounts: actual
          ? [{ accountId, accountCode: actual.row.accountCode, accountName: actual.row.accountName, amount: amount(actualMinor), lineCount: actual.row.lineCount }]
          : [],
        metadata: { favourable: actualMinor - budgetMinor >= 0 },
      })
    );
  }

  const envelope = buildReportEnvelope(context, request, { id: 'BVA-FOUNDATION', name: 'Budget versus Actual', version: '1.0.0' }, {
    lines,
    totals: {
      actual: amount(lines.reduce((s, l) => s + l.currentAmount.minor, 0)),
      budget: amount(lines.reduce((s, l) => s + (l.budgetAmount?.minor ?? 0), 0)),
    },
    unresolvedExceptions: [],
    sourceNotes: 'Actuals from canonical General Ledger; budget rows never post to the ledger.',
  });
  envelope.integrityStatus = REPORT_INTEGRITY_STATUS.VERIFIED;
  return envelope;
}
