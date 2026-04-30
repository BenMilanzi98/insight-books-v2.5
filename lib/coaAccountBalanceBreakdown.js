/**
 * Single-account balance traceability for CoA (matches chart list row logic before parent rollup).
 */
import {
  fetchTenantAccountsForMergeRollup,
  buildMergeRollupContext,
} from '@/lib/accountMergeRollup';
import { CODE_ACCOUNTS_RECEIVABLE } from '@/lib/coaPostingCodes.js';
import { computePhysicalInventoryValuationTotal } from '@/lib/stockValuationAggregate.js';

const postedJournalStatus = { in: ['Posted', 'posted'] };
const postedGlTransactionStatus = { in: ['posted', 'Posted'] };

function sumLinesDebitCredit(lines) {
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of lines || []) {
    totalDebit += parseFloat(line.debitAmount) || 0;
    totalCredit += parseFloat(line.creditAmount) || 0;
  }
  return { totalDebit, totalCredit, lineCount: (lines || []).length };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @returns {Promise<{ total: number, unpaidCount: number, lines: Array<{ id: string, invoiceNumber: string|null, status: string|null, actualRemaining: number, accumulatedAmount: number, runningTotalAfterThisSource: number }> }>}
 */
export async function computeArSubledgerFromInvoices(prisma, tenantId, { maxLines = 100 } = {}) {
  const allInvoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      voidedAt: null,
      refundedAt: null,
    },
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      totalPaid: true,
      remainingBalance: true,
      status: true,
      payments: {
        where: { status: 'Completed' },
        select: { amount: true, status: true },
      },
    },
    orderBy: { issueDate: 'desc' },
  });

  const invoicesWithActualBalance = allInvoices.map((inv) => {
    const actualTotalPaid = inv.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const actualRemaining = Math.max(0, parseFloat(inv.total) - actualTotalPaid);
    return { ...inv, actualTotalPaid, actualRemaining };
  });

  const excludedStatuses = [
    'paid',
    'completed',
    'void',
    'refunded',
    'fully refunded',
    'draft',
    'cancelled',
    'closed',
  ];
  const unpaidStatuses = ['unpaid', 'pending', 'partially paid', 'partial', 'sent'];

  const unpaidInvoices = invoicesWithActualBalance.filter((inv) => {
    const status = (inv.status || '').toLowerCase().trim();
    const remaining = inv.actualRemaining;
    if (excludedStatuses.includes(status)) return false;
    const isUnpaidStatus = unpaidStatuses.some((us) => status === us || status.includes(us));
    return isUnpaidStatus && remaining > 0;
  });

  const total = unpaidInvoices.reduce((sum, inv) => sum + Math.max(0, inv.actualRemaining), 0);
  let running = 0;
  const withRunning = unpaidInvoices.map((inv) => {
    const actualRemaining = Math.max(0, inv.actualRemaining);
    running += actualRemaining;
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      actualRemaining,
      accumulatedAmount: actualRemaining,
      runningTotalAfterThisSource: running,
    };
  });
  const lines = withRunning.slice(0, maxLines);

  return { total, unpaidCount: unpaidInvoices.length, lines };
}

/**
 * Same rules as chart GET /api/chart-of-accounts and GET /api/stock/statistics (branch scope + valuation).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {object} user — session user (tenantId, allowedBranchIds, …)
 * @param {URLSearchParams} [searchParams] — optional `branchId` / `allBranches` (default all branches)
 */
export async function computeInventoryStockAggregate(prisma, tenantId, user, searchParams) {
  if (!user?.tenantId) {
    return { total: 0, productCount: 0, productsSampled: 0 };
  }
  const r = await computePhysicalInventoryValuationTotal(prisma, tenantId, user, searchParams);
  return { total: r.total, productCount: r.productCount, productsSampled: r.productCount };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {object} account — row with id, accountCode, code, accountName, name, accountType, type, normalBalance, balance
 * @param {{ inventoryUser?: object|null, inventorySearchParams?: URLSearchParams, maxInvoiceDetailLines?: number }} [opts]
 */
export async function computeCoaAccountBalanceBreakdown(
  prisma,
  tenantId,
  account,
  opts = {}
) {
  const inventoryUser = opts.inventoryUser ?? null;
  const inventorySearchParams = opts.inventorySearchParams ?? new URLSearchParams();
  const maxInvoiceDetailLines = opts.maxInvoiceDetailLines ?? 50;

  const mergeRollupRows = await fetchTenantAccountsForMergeRollup(tenantId, prisma);
  const mergeRollupCtx = buildMergeRollupContext(mergeRollupRows);
  const journalAccountIds = mergeRollupCtx.allIdsRollingInto(account.id);

  const [journalLines, txnLines, childCount] = await Promise.all([
    prisma.journalEntryLine.findMany({
      where: {
        accountId: { in: journalAccountIds },
        journalEntry: { status: postedJournalStatus, tenantId },
      },
      select: { debitAmount: true, creditAmount: true },
    }),
    prisma.transactionLine.findMany({
      where: {
        accountId: { in: journalAccountIds },
        transaction: { status: postedGlTransactionStatus, tenantId },
      },
      select: { debitAmount: true, creditAmount: true },
    }),
    prisma.account.count({ where: { tenantId, parentAccountId: account.id } }),
  ]);

  const j = sumLinesDebitCredit(journalLines);
  const t = sumLinesDebitCredit(txnLines);

  const at = account.accountType || account.type || '';
  const normalBalance =
    account.normalBalance ||
    (at === 'Asset' || at === 'Expense' ? 'Debit' : 'Credit');

  const netFromDrCr = (dr, cr) => (normalBalance === 'Debit' ? dr - cr : cr - dr);

  const glJournalNet = netFromDrCr(j.totalDebit, j.totalCredit);
  const glTransactionNet = netFromDrCr(t.totalDebit, t.totalCredit);
  const glBookBalance = netFromDrCr(j.totalDebit + t.totalDebit, j.totalCredit + t.totalCredit);
  const postedGlLineCount = j.lineCount + t.lineCount;
  const hasPostedGlActivity = postedGlLineCount > 0;

  const hasChildren = childCount > 0 || (Array.isArray(account.childAccounts) && account.childAccounts.length > 0);

  const accountCode = String(account.accountCode || account.code || '').trim();
  const accountName = (account.accountName || account.name || '').toLowerCase().trim();
  const accountType = (account.accountType || account.type || '').trim().toUpperCase();

  const isAccountsReceivableLeaf =
    !hasChildren &&
    (accountType === 'ASSET' || accountType === 'Asset') &&
    (accountCode === CODE_ACCOUNTS_RECEIVABLE ||
      (accountName.includes('receivable') &&
        !accountName.includes('payable') &&
        !accountName.includes('prepaid') &&
        accountCode.startsWith('12') &&
        accountCode !== '1210' &&
        accountCode !== '1215'));

  const isCustomInventoryName =
    accountCode !== '1300' &&
    accountName.includes('inventory') &&
    !accountName.includes('receivable');
  const isInventoryLedger =
    isCustomInventoryName && (accountType === 'ASSET' || accountType === 'Asset');

  let arDetail = null;
  if (!hasChildren && isAccountsReceivableLeaf && !hasPostedGlActivity) {
    arDetail = await computeArSubledgerFromInvoices(prisma, tenantId, {
      maxLines: maxInvoiceDetailLines,
    });
  }

  let inventoryDetail = null;
  if (!hasChildren && isInventoryLedger && !hasPostedGlActivity && inventoryUser) {
    inventoryDetail = await computeInventoryStockAggregate(
      prisma,
      tenantId,
      inventoryUser,
      inventorySearchParams
    );
  }

  const legacyBalance = parseFloat(account.balance) || 0;

  let balance = glBookBalance;
  if (!hasChildren && isAccountsReceivableLeaf && !hasPostedGlActivity) {
    balance = Math.max(0, arDetail.total);
  } else if (!hasChildren && isInventoryLedger && !hasPostedGlActivity) {
    balance = inventoryDetail.total;
  }

  let finalBalance;
  if (isAccountsReceivableLeaf || isInventoryLedger) {
    finalBalance = balance;
  } else if (hasPostedGlActivity) {
    finalBalance = balance;
  } else if (legacyBalance !== 0) {
    finalBalance = legacyBalance;
  } else {
    finalBalance = 0;
  }

  let balanceSource = 'none';
  if (hasPostedGlActivity) {
    balanceSource = 'posted_gl';
  } else if (isAccountsReceivableLeaf) {
    balanceSource = 'ar_subledger';
  } else if (isInventoryLedger) {
    balanceSource = 'inventory_subledger';
  } else if (legacyBalance !== 0) {
    balanceSource = 'legacy_account_balance';
  }

  const components = [];

  components.push({
    id: 'posted_journal_lines',
    label: 'Posted journal entry lines',
    debit: j.totalDebit,
    credit: j.totalCredit,
    netEffect: glJournalNet,
    lineCount: j.lineCount,
    note: 'All lines on this account and any CoA merge sources rolled into this code.',
  });

  components.push({
    id: 'posted_transaction_lines',
    label: 'Posted transaction lines (POS, payroll, etc.)',
    debit: t.totalDebit,
    credit: t.totalCredit,
    netEffect: glTransactionNet,
    lineCount: t.lineCount,
    note: 'Same merge rollup as journals.',
  });

  components.push({
    id: 'posted_gl_combined',
    label: 'Posted GL net (journals + transactions)',
    debit: j.totalDebit + t.totalDebit,
    credit: j.totalCredit + t.totalCredit,
    netEffect: glBookBalance,
    lineCount: postedGlLineCount,
  });

  if (!hasPostedGlActivity && isAccountsReceivableLeaf && arDetail) {
    components.push({
      id: 'ar_unpaid_invoices',
      label: 'Accounts receivable — unpaid invoice sub-ledger',
      amount: arDetail.total,
      lineCount: arDetail.unpaidCount,
      detailLines: arDetail.lines,
      note: 'Used only when this receivables leaf has no posted GL lines yet.',
    });
  }

  if (!hasPostedGlActivity && isInventoryLedger && inventoryDetail) {
    components.push({
      id: 'inventory_stock_aggregate',
      label: 'Inventory — stock valuation aggregate',
      amount: inventoryDetail.total,
      lineCount: inventoryDetail.productCount,
      note: 'Matches chart/stock rules for non-1300 inventory-named asset leaves without GL.',
    });
  }

  if (!hasPostedGlActivity && legacyBalance !== 0 && !isAccountsReceivableLeaf && !isInventoryLedger) {
    components.push({
      id: 'legacy_account_balance_field',
      label: 'Stored Account.balance (legacy)',
      amount: legacyBalance,
      note: 'Used when there is no posted activity on this row.',
    });
  }

  /** Signed contribution of this row; running total reconciles to displayedRowTotal down the table. */
  let running = 0;
  for (const c of components) {
    const part = Number(c.netEffect ?? c.amount ?? 0);
    c.accumulatedAmount = part;
    if (c.id === 'posted_journal_lines' || c.id === 'posted_transaction_lines') {
      running += part;
      c.runningTotalAfterThisSource = running;
    } else if (c.id === 'posted_gl_combined') {
      running = glBookBalance;
      c.runningTotalAfterThisSource = running;
    } else {
      running = part;
      c.runningTotalAfterThisSource = finalBalance;
    }
  }

  const mergeRollupPostingAccountIds = journalAccountIds;

  const notes = [];
  if (hasChildren) {
    notes.push(
      'This row is a parent/header: the chart grid total may include rolled-up child balances. Amounts above are only postings on this account code (and its merge sources), not children.'
    );
  }
  if (accountCode === '1300' && (accountType === 'ASSET' || accountType === 'Asset')) {
    notes.push(
      "Canonical 1300 inventory (chart grid): the list API reallocates the stock aggregate across the 1300 subtree to match Stock Management; the balance shown here is postings on this account id only until you compare to the chart row."
    );
  }
  if (accountCode === '1310' && (accountType === 'ASSET' || accountType === 'Asset')) {
    notes.push(
      '1310 Stock on Hand: on the chart grid, when there is no posted GL split across inventory leaves, the full stock valuation aggregate is shown on this leaf to tie out to Stock Management.'
    );
  }

  return {
    balanceSource,
    displayedRowTotal: finalBalance,
    /** Sum of accumulatedAmount on journal + transaction rows equals posted GL net when both exist. */
    reconciliationHint:
      'Accumulated = this source’s signed contribution. Running total = balance after applying sources in order through this row (matches displayed row total on the last applicable row).',
    postedGlNet: glBookBalance,
    normalBalance,
    hasPostedGlActivity,
    hasChildren,
    childAccountCount: childCount,
    mergeRollupPostingAccountIds,
    mergeRollupPostingAccountCount: mergeRollupPostingAccountIds.length,
    legacyStoredBalance: legacyBalance,
    components,
    notes,
  };
}
