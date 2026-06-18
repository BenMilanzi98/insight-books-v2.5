/**
 * GL-based balance sheet helpers — cumulative balances through as-of date.
 */
import prisma from '@/lib/prisma.js';
import { addMoney, roundMoney } from '@/lib/money.js';
import {
  CODE_ACCOUNTS_PAYABLE,
  CODE_ACCOUNTS_RECEIVABLE,
} from '@/lib/coaPostingCodes.js';
import { buildCoaAccountSourceHref } from '@/lib/coaReportAccountLinks.js';
import { fetchOfficialLedgerAsOfRows } from './fetchOfficialLedgerRows.js';
import {
  computeBalanceSheetAmount,
  hasMeaningfulAmount,
  isAssetAccount,
  isEquityAccount,
  isLiabilityAccount,
  roundReportAmount,
} from './accountClassification.js';
import { getControlAccountGlBalance } from './buildTaxSummaryFromGl.js';

function classifyAssetSection(account) {
  const subtype = String(account?.accountSubtype ?? '').toLowerCase();
  const name = String(account?.accountName ?? account?.name ?? '').toLowerCase();
  const code = String(account?.accountCode ?? '').trim();

  if (
    code.startsWith('111') ||
    code.startsWith('112') ||
    code.startsWith('113') ||
    subtype.includes('cash') ||
    name.includes('cash') ||
    name.includes('bank')
  ) {
    return 'current_cash';
  }
  if (code === CODE_ACCOUNTS_RECEIVABLE || subtype.includes('receivable')) {
    return 'current_receivable';
  }
  if (subtype.includes('inventory') || code.startsWith('13')) {
    return 'current_inventory';
  }
  if (subtype.includes('prepaid')) return 'current_prepaid';
  if (subtype.includes('non-current') || subtype.includes('fixed') || code.startsWith('15')) {
    return 'non_current';
  }
  return 'current_other';
}

function classifyLiabilitySection(account) {
  const subtype = String(account?.accountSubtype ?? '').toLowerCase();
  const code = String(account?.accountCode ?? '').trim();
  if (code === CODE_ACCOUNTS_PAYABLE || subtype.includes('payable')) return 'current_payable';
  if (subtype.includes('non-current') || subtype.includes('long-term') || code.startsWith('22')) {
    return 'non_current';
  }
  if (code.startsWith('204')) return 'current_tax';
  return 'current_other';
}

/**
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string|Date} params.asOfDate
 * @param {string|null} [params.branchId]
 * @param {import('@prisma/client').PrismaClient} [params.prisma]
 */
export async function buildBalanceSheetFromGl({
  tenantId,
  asOfDate,
  branchId = null,
  prisma: db = prisma,
}) {
  const { rows, sourcePolicy } = await fetchOfficialLedgerAsOfRows({
    tenantId,
    asOfDate,
    branchId,
    prisma: db,
  });

  const assets = { current: [], nonCurrent: [], total: 0 };
  const liabilities = { current: [], nonCurrent: [], total: 0 };
  const equity = { lines: [], total: 0 };

  for (const row of rows) {
    const account = row.account;
    const balance = roundReportAmount(computeBalanceSheetAmount(account, row.debitTotal, row.creditTotal));
    if (!hasMeaningfulAmount(balance)) continue;

    const line = {
      accountId: row.accountId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      balance,
      debitTotal: row.debitTotal,
      creditTotal: row.creditTotal,
      sourceHref: buildCoaAccountSourceHref({
        accountId: row.accountId,
        accountCode: row.accountCode,
      }),
    };

    if (isAssetAccount(account)) {
      const section = classifyAssetSection(account);
      if (section === 'non_current') {
        assets.nonCurrent.push(line);
      } else {
        assets.current.push(line);
      }
      assets.total = addMoney(assets.total, balance);
    } else if (isLiabilityAccount(account)) {
      const section = classifyLiabilitySection(account);
      if (section === 'non_current') {
        liabilities.nonCurrent.push(line);
      } else {
        liabilities.current.push(line);
      }
      liabilities.total = addMoney(liabilities.total, balance);
    } else if (isEquityAccount(account)) {
      equity.lines.push(line);
      equity.total = addMoney(equity.total, balance);
    }
  }

  const arGl = await getControlAccountGlBalance({
    tenantId,
    accountCode: CODE_ACCOUNTS_RECEIVABLE,
    asOfDate,
    branchId,
    prisma: db,
  });

  const apGl = await getControlAccountGlBalance({
    tenantId,
    accountCode: CODE_ACCOUNTS_PAYABLE,
    asOfDate,
    branchId,
    prisma: db,
  });

  const totalAssets = roundMoney(assets.total);
  const totalLiabilities = roundMoney(liabilities.total);
  const totalEquity = roundMoney(equity.total);
  const totalLiabilitiesAndEquity = roundMoney(addMoney(totalLiabilities, totalEquity));
  const difference = roundMoney(totalAssets - totalLiabilitiesAndEquity);

  return {
    source: 'general_ledger',
    sourcePolicy,
    asOfDate,
    assets,
    liabilities,
    equity,
    controlAccounts: {
      accountsReceivable: arGl,
      accountsPayable: apGl,
    },
    totals: {
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity,
      difference,
      balanced: Math.abs(difference) <= 0.01,
    },
  };
}

export { getControlAccountGlBalance };
