/**
 * Balance sheet account drill-down: balance sources + posted GL line traceability.
 */

import {
  fetchTenantAccountsForMergeRollup,
  buildMergeRollupContext,
} from './accountMergeRollup.js';
import { computeCoaAccountBalanceBreakdown } from './coaAccountBalanceBreakdown.js';
import { getTenantFiscalYearStartMonth } from './accountingPeriodService.js';
import { inferCoaNormalBalance } from './coaMoney.js';
import { addMoney, parseMoney, roundMoney, subtractMoney } from './money.js';
import {
  getSourceDocumentLabel,
  resolveSourceDocumentLabelsBatch,
} from './userFacingLabels.js';

const POSTED_STATUSES = ['posted', 'Posted', 'POSTED'];
const MAX_LEDGER_LINES = 500;

/**
 * @param {string|Date} asOfDate
 * @returns {Date}
 */
function parseAsOfEndOfDay(asOfDate) {
  if (asOfDate instanceof Date) {
    const d = new Date(asOfDate);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  const [year, month, day] = String(asOfDate).split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * @param {number} debit
 * @param {number} credit
 * @param {'Debit'|'Credit'} normalBalance
 */
function signedAmount(debit, credit, normalBalance) {
  const dr = parseMoney(debit);
  const cr = parseMoney(credit);
  return normalBalance === 'Debit' ? subtractMoney(dr, cr) : subtractMoney(cr, dr);
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {string} accountId
 * @param {{
 *   asOfDate: string|Date,
 *   branchId?: string|null,
 *   inventoryUser?: object|null,
 *   maxLedgerLines?: number,
 * }} opts
 */
export async function getBalanceSheetAccountTrace(prisma, tenantId, accountId, opts = {}) {
  const asOfEnd = parseAsOfEndOfDay(opts.asOfDate);
  const maxLedgerLines = opts.maxLedgerLines ?? MAX_LEDGER_LINES;
  const branchId = opts.branchId ?? null;
  const branchFilter = branchId ? { branchId } : {};

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      parentAccount: {
        select: { id: true, accountCode: true, accountName: true },
      },
      childAccounts: {
        select: { id: true, accountCode: true, accountName: true, isActive: true },
      },
    },
  });

  if (!account || account.tenantId !== tenantId) {
    throw new Error('Account not found');
  }

  const fiscalYearStartMonth = await getTenantFiscalYearStartMonth(tenantId, prisma);
  const glBranchFilter = branchId ? { branchId } : {};

  const balanceSources = await computeCoaAccountBalanceBreakdown(prisma, tenantId, account, {
    inventoryUser: opts.inventoryUser ?? null,
    inventorySearchParams: new URLSearchParams(),
    maxInvoiceDetailLines: 100,
    dateRange: { from: null, to: asOfEnd, invalid: false },
    glBranchFilter,
    fiscalYearStartMonth,
  });

  const mergeRollupRows = await fetchTenantAccountsForMergeRollup(tenantId, prisma);
  const mergeRollupCtx = buildMergeRollupContext(mergeRollupRows);
  const postingAccountIds =
    balanceSources.mergeRollupPostingAccountIds?.length > 0
      ? balanceSources.mergeRollupPostingAccountIds
      : mergeRollupCtx.allIdsRollingInto(account.id);

  const accountById = new Map(mergeRollupRows.map((a) => [a.id, a]));
  const normalBalance = inferCoaNormalBalance(account);

  const journalDateFilter = {
    OR: [
      { entryDate: { lte: asOfEnd } },
      { AND: [{ entryDate: null }, { postedDate: { lte: asOfEnd } }] },
    ],
  };

  const [transactionLines, journalLines] = await Promise.all([
    prisma.transactionLine.findMany({
      where: {
        accountId: { in: postingAccountIds },
        transaction: {
          tenantId,
          status: { in: POSTED_STATUSES },
          date: { lte: asOfEnd },
          ...branchFilter,
        },
      },
      include: {
        account: {
          select: { id: true, accountCode: true, accountName: true },
        },
        transaction: {
          select: {
            id: true,
            date: true,
            description: true,
            reference: true,
            sourceType: true,
            sourceId: true,
            isReversal: true,
            reversedTransactionId: true,
          },
        },
      },
    }),
    prisma.journalEntryLine.findMany({
      where: {
        accountId: { in: postingAccountIds },
        journalEntry: {
          tenantId,
          status: { in: POSTED_STATUSES },
          transactionId: null,
          ...branchFilter,
          ...journalDateFilter,
        },
      },
      include: {
        account: {
          select: { id: true, accountCode: true, accountName: true },
        },
        journalEntry: {
          select: {
            id: true,
            entryDate: true,
            postedDate: true,
            description: true,
            referenceNumber: true,
            sourceType: true,
            sourceId: true,
          },
        },
      },
    }),
  ]);

  const labelItems = [
    ...transactionLines.map((line) => ({
      sourceType: line.transaction?.sourceType,
      sourceId: line.transaction?.sourceId,
    })),
    ...journalLines.map((line) => ({
      sourceType: line.journalEntry?.sourceType,
      sourceId: line.journalEntry?.sourceId,
    })),
  ];
  const sourceLabels = await resolveSourceDocumentLabelsBatch(prisma, tenantId, labelItems);

  /** @type {Array<object>} */
  const rawEntries = [];

  for (const line of transactionLines) {
    const txn = line.transaction;
    if (!txn) continue;
    const postingAccount = line.account;
    const isMergedSource = postingAccount?.id && postingAccount.id !== account.id;
    rawEntries.push({
      id: `txn-${line.id}`,
      lineId: line.id,
      entryKind: 'transaction',
      date: txn.date,
      description: txn.description || '',
      reference: txn.reference || '',
      sourceType: txn.sourceType,
      sourceId: txn.sourceId,
      sourceLabel: getSourceDocumentLabel(
        sourceLabels,
        txn.sourceType,
        txn.sourceId,
        txn.reference || txn.description
      ),
      debitAmount: parseMoney(line.debitAmount),
      creditAmount: parseMoney(line.creditAmount),
      signedAmount: signedAmount(line.debitAmount, line.creditAmount, normalBalance),
      isReversal: Boolean(txn.isReversal),
      postingAccountCode: postingAccount?.accountCode || null,
      postingAccountName: postingAccount?.accountName || null,
      postingAccountId: postingAccount?.id || null,
      isMergedSourcePosting: isMergedSource,
    });
  }

  for (const line of journalLines) {
    const je = line.journalEntry;
    if (!je) continue;
    const postingAccount = line.account;
    const isMergedSource = postingAccount?.id && postingAccount.id !== account.id;
    rawEntries.push({
      id: `je-${line.id}`,
      lineId: line.id,
      entryKind: 'journal',
      date: je.entryDate || je.postedDate,
      description: je.description || '',
      reference: je.referenceNumber || '',
      sourceType: je.sourceType || 'JournalEntry',
      sourceId: je.sourceId || je.id,
      sourceLabel: getSourceDocumentLabel(
        sourceLabels,
        je.sourceType,
        je.sourceId,
        je.referenceNumber || je.description
      ),
      debitAmount: parseMoney(line.debitAmount),
      creditAmount: parseMoney(line.creditAmount),
      signedAmount: signedAmount(line.debitAmount, line.creditAmount, normalBalance),
      isReversal: false,
      postingAccountCode: postingAccount?.accountCode || null,
      postingAccountName: postingAccount?.accountName || null,
      postingAccountId: postingAccount?.id || null,
      isMergedSourcePosting: isMergedSource,
    });
  }

  rawEntries.sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    if (da !== db) return da - db;
    return String(a.id).localeCompare(String(b.id));
  });

  let running = 0;
  const withRunning = rawEntries.map((entry) => {
    running = addMoney(running, entry.signedAmount);
    return { ...entry, runningBalance: roundMoney(running) };
  });

  const ledgerEntries = [...withRunning].reverse().slice(0, maxLedgerLines);
  const ledgerTruncated = withRunning.length > maxLedgerLines;

  const mergedSourceAccounts = postingAccountIds
    .filter((id) => id !== account.id)
    .map((id) => {
      const row = accountById.get(id);
      return row
        ? {
            accountId: id,
            accountCode: row.accountCode || row.code || '',
            accountName: row.accountName || row.name || '',
          }
        : { accountId: id, accountCode: '', accountName: '' };
    })
    .filter((row) => row.accountCode || row.accountName);

  return {
    account: {
      id: account.id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      normalBalance,
      parentAccount: account.parentAccount,
    },
    asOfDate: asOfEnd.toISOString(),
    balance: balanceSources.displayedRowTotal,
    chartGridEquivalentTotal: balanceSources.chartGridEquivalentTotal,
    balanceSource: balanceSources.balanceSource,
    balanceSources,
    ledgerSummary: {
      lineCount: withRunning.length,
      totalDebits: roundMoney(
        withRunning.reduce((s, e) => addMoney(s, e.debitAmount), 0)
      ),
      totalCredits: roundMoney(
        withRunning.reduce((s, e) => addMoney(s, e.creditAmount), 0)
      ),
      postedGlNet: balanceSources.postedGlNet,
      normalBalance,
    },
    ledgerEntries,
    ledgerTruncated,
    mergedSourceAccounts,
    notes: balanceSources.notes || [],
  };
}
