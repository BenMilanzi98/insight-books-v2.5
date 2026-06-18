/**
 * GL-based tax summary — Malawi tax inflow (2041) and outflow (2045) accounts.
 */
import prisma from '@/lib/prisma.js';
import { addMoney, roundMoney } from '@/lib/money.js';
import { MALAWI_TAX_CATALOG } from '@/lib/malawiTaxCatalog.js';
import { buildCoaAccountSourceHref } from '@/lib/coaReportAccountLinks.js';
import { fetchOfficialLedgerRows } from './fetchOfficialLedgerRows.js';
import {
  computePeriodNetMovement,
  hasMeaningfulAmount,
  isTaxInflowAccount,
  isTaxOutflowAccount,
  roundReportAmount,
} from './accountClassification.js';

/**
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string|Date} params.startDate
 * @param {string|Date} params.endDate
 * @param {string|null} [params.branchId]
 * @param {import('@prisma/client').PrismaClient} [params.prisma]
 */
export async function buildTaxSummaryFromGl({
  tenantId,
  startDate,
  endDate,
  branchId = null,
  prisma: db = prisma,
}) {
  const { rows, sourcePolicy } = await fetchOfficialLedgerRows({
    tenantId,
    startDate,
    endDate,
    branchId,
    prisma: db,
  });

  const catalogByGlCode = new Map(
    MALAWI_TAX_CATALOG.map((e) => [e.glCode, e])
  );

  const outputTaxLines = [];
  const inputTaxLines = [];

  for (const row of rows) {
    const account = row.account;
    const code = row.accountCode;

    if (!isTaxInflowAccount(account) && !isTaxOutflowAccount(account)) continue;
    if (!hasMeaningfulAmount(row.netMovement)) continue;

    const catalogEntry = catalogByGlCode.get(code);
    const net = computePeriodNetMovement(account, row.debitTotal, row.creditTotal);
    const line = {
      accountId: row.accountId,
      accountCode: code,
      accountName: row.accountName,
      taxId: catalogEntry?.taxId ?? null,
      taxName: catalogEntry?.taxName ?? row.accountName,
      flow: isTaxInflowAccount(account) ? 'inflow' : 'outflow',
      debitTotal: row.debitTotal,
      creditTotal: row.creditTotal,
      netMovement: roundReportAmount(net),
      amount: roundReportAmount(Math.abs(net)),
      sourceHref: buildCoaAccountSourceHref({
        accountId: row.accountId,
        accountCode: code,
      }),
    };

    if (isTaxInflowAccount(account)) {
      outputTaxLines.push(line);
    } else {
      inputTaxLines.push(line);
    }
  }

  const totalOutputTax = roundMoney(
    outputTaxLines.reduce((s, l) => addMoney(s, l.amount), 0)
  );
  const totalInputTax = roundMoney(
    inputTaxLines.reduce((s, l) => addMoney(s, l.amount), 0)
  );
  const netTaxPayable = roundMoney(totalOutputTax - totalInputTax);

  return {
    source: 'general_ledger',
    sourcePolicy,
    outputTax: {
      lines: outputTaxLines,
      total: totalOutputTax,
    },
    inputTax: {
      lines: inputTaxLines,
      total: totalInputTax,
    },
    netTaxPayable,
    netTaxReceivable: netTaxPayable < 0 ? roundMoney(Math.abs(netTaxPayable)) : 0,
    hasGlActivity: outputTaxLines.length > 0 || inputTaxLines.length > 0,
  };
}

/**
 * Resolve GL balance for a control account code as-of date.
 */
export async function getControlAccountGlBalance({
  tenantId,
  accountCode,
  asOfDate,
  branchId = null,
  prisma: db = prisma,
}) {
  const account = await db.account.findFirst({
    where: {
      tenantId,
      accountCode,
      mergedIntoAccountId: null,
    },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      accountType: true,
      normalBalance: true,
    },
  });

  if (!account) {
    return { accountId: null, accountCode, balance: 0, found: false };
  }

  const { rows } = await fetchOfficialLedgerRows({
    tenantId,
    startDate: '1970-01-01',
    endDate: asOfDate,
    branchId,
    prisma: db,
  });

  const row = rows.find((r) => r.accountId === account.id);
  const balance = row ? roundReportAmount(row.netMovement) : 0;

  return {
    accountId: account.id,
    accountCode: account.accountCode,
    accountName: account.accountName,
    balance,
    found: true,
    debitTotal: row?.debitTotal ?? 0,
    creditTotal: row?.creditTotal ?? 0,
  };
}
