/**
 * GL-based cash flow classification — posted movements on cash/bank CoA accounts.
 */
import prisma from './prisma.js';
import { resolveCashAndBankAccounts, normalizedAccountCode } from './cashAccountCoa.js';
import {
  CANONICAL_SALARY_ACCOUNT_CODE,
  isDuplicateSalaryAccountCode,
  normalizeSalaryAccountCode,
} from './salaryExpenseAccountCodes.js';
import { addMoney, roundMoney, subtractMoney } from './money.js';

const SALARY_CODES = new Set(['5301', '5200', '5300', '5310', '5302', '5230', '5201']);
const RENT_CODES = new Set(['5320', '5001']);
const COGS_CODES = new Set(['5100', '5002', '5003']);

function accountTypeUpper(account) {
  return String(account?.accountType ?? account?.type ?? '').trim().toUpperCase();
}

function accountNameLower(account) {
  return String(account?.accountName ?? account?.name ?? '').toLowerCase();
}

function codeNumeric(code) {
  const m = String(code || '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * @param {{ accountCode?: string, accountName?: string, accountType?: string, type?: string }} account
 * @returns {'customer'|'other_receipt'|'supplier'|'salary'|'rent'|'other_expense'|'asset'|'loan'|'internal'|'other'}
 */
export function classifyCounterAccountForCashFlow(account) {
  if (!account) return 'other';
  const code = normalizedAccountCode(account);
  const normSalary = normalizeSalaryAccountCode(code);
  const name = accountNameLower(account);
  const type = accountTypeUpper(account);
  const n = codeNumeric(code);

  if (type.includes('INCOME') || type.includes('REVENUE') || (n >= 4000 && n < 5000)) {
    return 'customer';
  }
  if (code === '1200' || name.includes('receivable')) return 'customer';
  if (type.includes('EQUITY') || (n >= 3000 && n < 4000) || name.includes('capital')) {
    return 'other_receipt';
  }
  if (COGS_CODES.has(code) || name.includes('cost of goods') || name.includes('cogs')) {
    return 'supplier';
  }
  if (
    SALARY_CODES.has(code) ||
    normSalary === CANONICAL_SALARY_ACCOUNT_CODE ||
    isDuplicateSalaryAccountCode(code) ||
    name.includes('salary') ||
    name.includes('salaries') ||
    name.includes('payroll') ||
    name.includes('wage')
  ) {
    return 'salary';
  }
  if (RENT_CODES.has(code) || name.includes('rent')) return 'rent';
  if ((n >= 1500 && n < 1590) || (n >= 1510 && n <= 1540)) return 'asset';
  if (type.includes('LIABILITY') || (n >= 2000 && n < 3000)) {
    if (name.includes('loan') || name.includes('borrowing') || n >= 2200) return 'loan';
    if (name.includes('payable') || name.includes('supplier') || name.includes('vendor')) return 'supplier';
    return 'other_expense';
  }
  if (type.includes('EXPENSE') || (n >= 5000 && n < 6000)) return 'other_expense';
  return 'other';
}

const INFLOW_KEYS = {
  customer: 'cash-from-customers',
  other_receipt: 'other-cash-receipts',
  other: 'other-cash-receipts',
};

const OUTFLOW_KEYS = {
  supplier: 'payments-to-suppliers',
  salary: 'salary-payments',
  rent: 'rent-payments',
  other_expense: 'other-expense-payments',
  asset: 'asset-purchases',
  loan: 'loan-payments',
  other: 'other-expense-payments',
};

const INFLOW_LABELS = {
  customer: 'Cash from Customer Payments',
  other_receipt: 'Other Cash Receipts',
  other: 'Other Cash Receipts',
};

const OUTFLOW_LABELS = {
  supplier: 'Payments to Suppliers',
  salary: 'Salary Payments',
  rent: 'Rent Payments',
  other_expense: 'Other Expense Payments',
  asset: 'Asset Purchases',
  loan: 'Loan Payments',
  other: 'Other Expense Payments',
};

function emptyBuckets() {
  return {
    inflows: {
      customer: { value: 0, details: [] },
      other_receipt: { value: 0, details: [] },
      other: { value: 0, details: [] },
    },
    outflows: {
      supplier: { value: 0, details: [] },
      salary: { value: 0, details: [] },
      rent: { value: 0, details: [] },
      other_expense: { value: 0, details: [] },
      asset: { value: 0, details: [] },
      loan: { value: 0, details: [] },
      other: { value: 0, details: [] },
    },
    loanPrincipal: 0,
    loanInterest: 0,
  };
}

/**
 * Classify posted GL cash movements for the period.
 *
 * @param {string} tenantId
 * @param {Date} start
 * @param {Date} end
 * @param {string|null} [branchId]
 */
export async function classifyCashFlowFromGl(tenantId, start, end, branchId = null) {
  const cashAccounts = await resolveCashAndBankAccounts(tenantId);
  const cashAccountIds = new Set(cashAccounts.map((a) => a.id));
  const accountById = new Map(cashAccounts.map((a) => [a.id, a]));

  if (!cashAccountIds.size) {
    return {
      cashAccounts: [],
      buckets: emptyBuckets(),
      glNetMovement: 0,
      transactionCount: 0,
      source: 'gl',
    };
  }

  const allAccounts = await prisma.account.findMany({
    where: { tenantId },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      code: true,
      name: true,
      accountType: true,
      type: true,
    },
  });
  for (const a of allAccounts) accountById.set(a.id, a);

  const branchFilter = branchId ? { branchId } : {};

  const lines = await prisma.transactionLine.findMany({
    where: {
      accountId: { in: [...cashAccountIds] },
      transaction: {
        tenantId,
        status: { in: ['posted', 'Posted'] },
        isReversal: false,
        date: { gte: start, lte: end },
        ...branchFilter,
      },
    },
    include: {
      transaction: {
        select: {
          id: true,
          date: true,
          description: true,
          reference: true,
          sourceType: true,
          sourceId: true,
        },
      },
    },
    orderBy: [{ transaction: { date: 'asc' } }, { lineNumber: 'asc' }],
  });

  const txnIds = [...new Set(lines.map((l) => l.transactionId))];
  const allTxnLines =
    txnIds.length > 0
      ? await prisma.transactionLine.findMany({
          where: { transactionId: { in: txnIds } },
          select: {
            transactionId: true,
            accountId: true,
            debitAmount: true,
            creditAmount: true,
            description: true,
          },
        })
      : [];

  const linesByTxn = new Map();
  for (const l of allTxnLines) {
    if (!linesByTxn.has(l.transactionId)) linesByTxn.set(l.transactionId, []);
    linesByTxn.get(l.transactionId).push(l);
  }

  const buckets = emptyBuckets();
  let glNetMovement = 0;
  const seenTxn = new Set();

  for (const cashLine of lines) {
    const cashDelta = subtractMoney(cashLine.debitAmount, cashLine.creditAmount);
    if (Math.abs(cashDelta) < 1e-9) continue;
    glNetMovement = addMoney(glNetMovement, cashDelta);

    const txn = cashLine.transaction;
    if (!txn || seenTxn.has(txn.id)) continue;
    seenTxn.add(txn.id);

    const txnLines = linesByTxn.get(txn.id) || [];
    let txnCashNet = 0;
    for (const tl of txnLines) {
      if (!cashAccountIds.has(tl.accountId)) continue;
      txnCashNet = addMoney(txnCashNet, subtractMoney(tl.debitAmount, tl.creditAmount));
    }
    if (Math.abs(txnCashNet) < 1e-9) continue;

    const counterLines = txnLines.filter((tl) => !cashAccountIds.has(tl.accountId));
    let primaryCounter = null;
    let primaryAmount = 0;
    for (const cl of counterLines) {
      const amt = Math.abs(subtractMoney(cl.debitAmount, cl.creditAmount));
      if (amt > primaryAmount) {
        primaryAmount = amt;
        primaryCounter = accountById.get(cl.accountId);
      }
    }

    const category = classifyCounterAccountForCashFlow(primaryCounter);
    const absAmount = Math.abs(txnCashNet);
    const detail = {
      date: txn.date,
      description: txn.description || cashLine.description || 'GL cash movement',
      reference: txn.reference || txn.id,
      amount: absAmount,
      sourceType: txn.sourceType || 'GL',
      counterAccountCode: primaryCounter ? normalizedAccountCode(primaryCounter) : null,
      counterAccountName: primaryCounter?.accountName ?? primaryCounter?.name ?? null,
      type: category,
    };

    if (txnCashNet > 0) {
      const bucketKey = INFLOW_KEYS[category] || 'other-cash-receipts';
      const mapKey = category === 'customer' ? 'customer' : category === 'other_receipt' ? 'other_receipt' : 'other';
      buckets.inflows[mapKey].value = addMoney(buckets.inflows[mapKey].value, absAmount);
      buckets.inflows[mapKey].details.push({ ...detail, type: mapKey === 'customer' ? 'customer_payment' : 'other_receipt' });
    } else {
      const mapKey =
        category in buckets.outflows ? category : 'other_expense';
      buckets.outflows[mapKey].value = addMoney(buckets.outflows[mapKey].value, absAmount);
      buckets.outflows[mapKey].details.push({
        ...detail,
        type: mapKey === 'loan' ? 'loan_payment' : mapKey,
      });
      if (mapKey === 'loan') {
        const desc = (txn.description || '').toLowerCase();
        if (desc.includes('interest')) {
          buckets.loanInterest = addMoney(buckets.loanInterest, absAmount);
        } else {
          buckets.loanPrincipal = addMoney(buckets.loanPrincipal, absAmount);
        }
      }
    }
  }

  return {
    cashAccounts: cashAccounts.map((a) => ({
      accountId: a.id,
      accountCode: a.accountCode,
      accountName: a.accountName,
    })),
    buckets,
    glNetMovement: roundMoney(glNetMovement),
    transactionCount: seenTxn.size,
    source: 'gl',
  };
}

export function bucketsToLineItems(buckets) {
  /** Merge line items that share the same report key (e.g. other_expense + other → other-expense-payments). */
  function mergeByReportKey(items) {
    const byKey = new Map();
    for (const item of items) {
      const existing = byKey.get(item.key);
      if (!existing) {
        byKey.set(item.key, {
          ...item,
          details: [...(item.details || [])],
        });
        continue;
      }
      existing.value = roundMoney(addMoney(existing.value, item.value));
      existing.details = [...(existing.details || []), ...(item.details || [])];
      if (item.principalPaid != null) {
        existing.principalPaid = roundMoney(
          addMoney(existing.principalPaid || 0, item.principalPaid)
        );
      }
      if (item.interestPaid != null) {
        existing.interestPaid = roundMoney(
          addMoney(existing.interestPaid || 0, item.interestPaid)
        );
      }
    }
    return [...byKey.values()];
  }

  const inflowItems = [];
  for (const [key, data] of Object.entries(buckets.inflows)) {
    if ((data.value || 0) <= 0.000001) continue;
    inflowItems.push({
      key: INFLOW_KEYS[key] || `inflow-${key}`,
      label: INFLOW_LABELS[key] || key,
      value: roundMoney(data.value),
      details: data.details,
    });
  }

  const outflowItems = [];
  for (const [key, data] of Object.entries(buckets.outflows)) {
    if ((data.value || 0) <= 0.000001) continue;
    const item = {
      key: OUTFLOW_KEYS[key] || `outflow-${key}`,
      label: OUTFLOW_LABELS[key] || key,
      value: roundMoney(data.value),
      details: data.details,
    };
    if (key === 'loan') {
      item.principalPaid = roundMoney(buckets.loanPrincipal);
      item.interestPaid = roundMoney(buckets.loanInterest);
    }
    outflowItems.push(item);
  }

  return {
    inflowItems: mergeByReportKey(inflowItems),
    outflowItems: mergeByReportKey(outflowItems),
  };
}

export function sumBucketValues(buckets) {
  let inflows = 0;
  let outflows = 0;
  for (const b of Object.values(buckets.inflows)) inflows = addMoney(inflows, b.value);
  for (const b of Object.values(buckets.outflows)) outflows = addMoney(outflows, b.value);
  return { inflows: roundMoney(inflows), outflows: roundMoney(outflows) };
}
