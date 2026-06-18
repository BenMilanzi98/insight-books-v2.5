/**
 * General Ledger–based Profit & Loss builder.
 * Source of truth: posted GL survivor totals + Chart of Accounts classification.
 */
import { addMoney, roundMoney } from '@/lib/money.js';
import { buildCoaAccountSourceHref } from '@/lib/coaReportAccountLinks.js';
import { fetchOfficialLedgerRows } from './fetchOfficialLedgerRows.js';
import {
  hasMeaningfulAmount,
  isCostOfSalesAccount,
  isIncomeAccount,
  isOperatingExpenseAccount,
  isOtherExpenseAccount,
  isOtherIncomeAccount,
  roundReportAmount,
} from './accountClassification.js';

function toLineItem(row, sectionKey) {
  const amount = roundReportAmount(Math.abs(row.netMovement));
  return {
    key: `${sectionKey}-${row.accountId}`,
    label: row.accountName,
    amount,
    signedAmount: roundReportAmount(row.netMovement),
    accountId: row.accountId,
    accountCode: row.accountCode,
    accountType: row.accountType,
    accountSubtype: row.accountSubtype,
    debitTotal: row.debitTotal,
    creditTotal: row.creditTotal,
    sourceHref: buildCoaAccountSourceHref({
      accountId: row.accountId,
      accountCode: row.accountCode,
    }),
    details: [],
  };
}

/**
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string|Date} params.startDate
 * @param {string|Date} params.endDate
 * @param {string|null} [params.branchId]
 * @param {import('@prisma/client').PrismaClient} [params.prisma]
 */
export async function buildProfitAndLossFromGl({
  tenantId,
  startDate,
  endDate,
  branchId = null,
  prisma,
}) {
  const { rows, sourcePolicy } = await fetchOfficialLedgerRows({
    tenantId,
    startDate,
    endDate,
    branchId,
    prisma,
  });

  const revenueLines = [];
  const otherIncomeLines = [];
  const cogsLines = [];
  const operatingExpenseLines = [];
  const otherExpenseLines = [];

  for (const row of rows) {
    const account = row.account;
    const net = row.netMovement;

    if (isIncomeAccount(account)) {
      if (isOtherIncomeAccount(account)) {
        if (hasMeaningfulAmount(net)) otherIncomeLines.push(toLineItem(row, 'other-income'));
      } else if (hasMeaningfulAmount(net)) {
        revenueLines.push(toLineItem(row, 'revenue'));
      }
      continue;
    }

    if (isCostOfSalesAccount(account)) {
      if (hasMeaningfulAmount(net)) cogsLines.push(toLineItem(row, 'cogs'));
      continue;
    }

    if (isOperatingExpenseAccount(account)) {
      if (hasMeaningfulAmount(net)) operatingExpenseLines.push(toLineItem(row, 'opex'));
      continue;
    }

    if (isOtherExpenseAccount(account)) {
      if (hasMeaningfulAmount(net)) otherExpenseLines.push(toLineItem(row, 'other-expense'));
    }
  }

  const sumLines = (lines) =>
    roundMoney(lines.reduce((s, l) => addMoney(s, l.amount), 0));

  const totalRevenue = sumLines(revenueLines);
  const totalOtherIncome = sumLines(otherIncomeLines);
  const totalCogs = sumLines(cogsLines);
  const totalOperatingExpenses = sumLines(operatingExpenseLines);
  const totalOtherExpenses = sumLines(otherExpenseLines);

  const grossProfit = roundMoney(totalRevenue - totalCogs);
  const operatingIncome = roundMoney(grossProfit - totalOperatingExpenses);
  const netProfit = roundMoney(
    operatingIncome + totalOtherIncome - totalOtherExpenses
  );

  const hasGlActivity =
    hasMeaningfulAmount(totalRevenue) ||
    hasMeaningfulAmount(totalCogs) ||
    hasMeaningfulAmount(totalOperatingExpenses) ||
    hasMeaningfulAmount(totalOtherIncome) ||
    hasMeaningfulAmount(totalOtherExpenses);

  return {
    source: 'general_ledger',
    sourcePolicy,
    hasGlActivity,
    revenue: {
      lineItems: revenueLines,
      total: totalRevenue,
      otherIncome: totalOtherIncome,
      otherIncomeLineItems: otherIncomeLines,
    },
    cogs: {
      lineItems: cogsLines,
      total: totalCogs,
      fromGeneralLedger: cogsLines.length > 0,
    },
    operatingExpenses: {
      lineItems: operatingExpenseLines,
      total: totalOperatingExpenses,
    },
    otherIncomeExpenses: {
      otherIncome: totalOtherIncome,
      otherExpenses: totalOtherExpenses,
      otherIncomeLineItems: otherIncomeLines,
      otherExpenseLineItems: otherExpenseLines,
      total: roundMoney(totalOtherIncome - totalOtherExpenses),
    },
    grossProfit,
    grossProfitMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
    operatingIncome,
    netProfit,
    netProfitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
    totalRevenue,
  };
}
