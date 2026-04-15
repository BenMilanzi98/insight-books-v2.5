/**
 * POS cash register: opening balance (synced to system Cash account), deposits, day close.
 */
import prisma from './prisma';
import { updateAccountBalance } from './core';
import {
  getSystemCashPaymentAccount,
  resolvePaymentAccountBalance,
} from './paymentAccountBalanceResolver';
import { sumCashSalesForPosDay } from './posDailyReportService';

export const POS_CASH_BRANCH_KEY = 'none';

function todayYyyyMmDd() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Auto-close any OPEN POS cash days strictly before `beforeDate` (YYYY-MM-DD).
 */
export async function closeStalePosCashDays(tenantId, beforeDate, closedById = null, client = prisma) {
  const rows = await client.posCashDay.findMany({
    where: {
      tenantId,
      status: 'OPEN',
      businessDate: { lt: beforeDate },
    },
  });
  for (const day of rows) {
    await finalizePosCashDayClose({
      tenantId,
      posCashDay: day,
      closedById,
      autoClosed: true,
      client,
    });
  }
  return rows.length;
}

async function finalizePosCashDayClose({ tenantId, posCashDay, closedById, autoClosed, client }) {
  const cashAcc = await client.paymentAccount.findUnique({
    where: { id: posCashDay.systemCashAccountId },
  });
  if (!cashAcc) return;

  const { totalCashSales, report } = await sumCashSalesForPosDay(
    tenantId,
    posCashDay.businessDate,
    null,
    { branchIdsIn: null },
    posCashDay.systemCashAccountId
  );

  const deposits = await client.posCashDayDeposit.findMany({
    where: { posCashDayId: posCashDay.id },
  });
  const depositsSum = deposits.reduce((s, d) => s + Number(d.amount || 0), 0);
  const opening = Number(posCashDay.openingBalance || 0);
  const remaining = Math.max(0, opening + totalCashSales - depositsSum);

  if (remaining > 0.0001) {
    await client.posCashDayDeposit.create({
      data: {
        posCashDayId: posCashDay.id,
        toAccountId: posCashDay.systemCashAccountId,
        amount: remaining,
        notes: 'Auto sweep at day close (undeposited cash)',
        isAutoSweep: true,
        createdById: closedById,
      },
    });
    // Same-account sweep: no AccountBalance movement; audit trail only.
  }

  const totalSales = Number(report?.totalSales ?? 0);
  const closingBalance = opening + totalSales;

  await client.posCashDay.update({
    where: { id: posCashDay.id },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      closedById,
      autoClosed: Boolean(autoClosed),
      totalSalesAtClose: totalSales,
      closingBalanceAtClose: closingBalance,
      totalCashSalesSnapshot: totalCashSales,
    },
  });
}

export async function openPosCashDay({ tenantId, userId, businessDate, client = prisma }) {
  const date = businessDate || todayYyyyMmDd();
  await closeStalePosCashDays(tenantId, date, userId, client);

  const existing = await client.posCashDay.findUnique({
    where: {
      tenantId_branchKey_businessDate: {
        tenantId,
        branchKey: POS_CASH_BRANCH_KEY,
        businessDate: date,
      },
    },
  });
  if (existing?.status === 'OPEN') {
    const err = new Error('A POS day is already open for this date.');
    err.code = 'ALREADY_OPEN';
    throw err;
  }
  if (existing?.status === 'CLOSED') {
    const err = new Error('This business day is already closed. Select a different date.');
    err.code = 'ALREADY_CLOSED';
    throw err;
  }

  const systemCash = await getSystemCashPaymentAccount(tenantId, client);
  if (!systemCash) {
    throw new Error('System Cash payment account is missing. Open Payment Management to initialize accounts.');
  }

  const openingBalance = await resolvePaymentAccountBalance(tenantId, systemCash, client);

  return client.posCashDay.create({
    data: {
      tenantId,
      branchKey: POS_CASH_BRANCH_KEY,
      businessDate: date,
      status: 'OPEN',
      systemCashAccountId: systemCash.id,
      openingBalance,
      openedById: userId || null,
    },
    include: {
      systemCashAccount: { select: { id: true, name: true, accountType: true } },
      deposits: true,
    },
  });
}

export async function closePosCashDayManual({ tenantId, userId, businessDate, client = prisma }) {
  const date = businessDate || todayYyyyMmDd();
  const day = await client.posCashDay.findUnique({
    where: {
      tenantId_branchKey_businessDate: {
        tenantId,
        branchKey: POS_CASH_BRANCH_KEY,
        businessDate: date,
      },
    },
  });
  if (!day || day.status !== 'OPEN') {
    const err = new Error('No open POS day found for this date.');
    err.code = 'NOT_OPEN';
    throw err;
  }
  await finalizePosCashDayClose({
    tenantId,
    posCashDay: day,
    closedById: userId,
    autoClosed: false,
    client,
  });
  return client.posCashDay.findUnique({
    where: { id: day.id },
    include: { deposits: { include: { toAccount: { select: { id: true, name: true } } } }, systemCashAccount: true },
  });
}

export async function depositPosCashDay({
  tenantId,
  userId,
  businessDate,
  lines,
  client = prisma,
}) {
  const date = businessDate || todayYyyyMmDd();
  const day = await client.posCashDay.findUnique({
    where: {
      tenantId_branchKey_businessDate: {
        tenantId,
        branchKey: POS_CASH_BRANCH_KEY,
        businessDate: date,
      },
    },
    include: { deposits: true },
  });
  if (!day || day.status !== 'OPEN') {
    const err = new Error('No open POS day for deposits.');
    err.code = 'NOT_OPEN';
    throw err;
  }

  const systemCashId = day.systemCashAccountId;
  const { totalCashSales } = await sumCashSalesForPosDay(
    tenantId,
    date,
    null,
    { branchIdsIn: null },
    systemCashId
  );

  const deposited = day.deposits.reduce((s, d) => s + Number(d.amount || 0), 0);
  const opening = Number(day.openingBalance || 0);
  const maxUndeposited = Math.max(0, opening + totalCashSales - deposited);

  const sumNew = lines.reduce((s, l) => s + Math.max(0, Number(l.amount) || 0), 0);
  if (sumNew <= 0) {
    throw new Error('Enter at least one positive deposit amount.');
  }
  if (sumNew - maxUndeposited > 0.01) {
    throw new Error(`Total deposit (${sumNew.toFixed(2)}) exceeds undeposited cash (${maxUndeposited.toFixed(2)}).`);
  }

  await client.$transaction(async (tx) => {
    for (const line of lines) {
      const amt = Math.max(0, Number(line.amount) || 0);
      const toId = line.toAccountId;
      if (!toId || amt <= 0) continue;
      if (toId === systemCashId) {
        await tx.posCashDayDeposit.create({
          data: {
            posCashDayId: day.id,
            toAccountId: toId,
            amount: amt,
            notes: line.notes || null,
            isAutoSweep: false,
            createdById: userId || null,
          },
        });
        continue;
      }
      await tx.posCashDayDeposit.create({
        data: {
          posCashDayId: day.id,
          toAccountId: toId,
          amount: amt,
          notes: line.notes || null,
          isAutoSweep: false,
          createdById: userId || null,
        },
      });
      await updateAccountBalance(tenantId, systemCashId, amt, 'subtract', tx);
      await updateAccountBalance(tenantId, toId, amt, 'add', tx);
    }
  });

  return client.posCashDay.findUnique({
    where: { id: day.id },
    include: {
      deposits: { include: { toAccount: { select: { id: true, name: true, accountType: true } } } },
      systemCashAccount: true,
    },
  });
}

/**
 * Close any OPEN POS cash day whose businessDate is before UTC `todayStr` (YYYY-MM-DD), for all tenants.
 * Intended for midnight cron.
 */
export async function sweepAllTenantsPosCashDays(client = prisma) {
  const todayStr = todayYyyyMmDd();
  const tenants = await client.tenant.findMany({ select: { id: true } });
  let daysClosed = 0;
  for (const t of tenants) {
    daysClosed += await closeStalePosCashDays(t.id, todayStr, null, client);
  }
  return { tenantCount: tenants.length, daysClosed, asOf: todayStr };
}

export async function getPosCashDayState(tenantId, businessDate, client = prisma) {
  const date = businessDate || todayYyyyMmDd();
  await closeStalePosCashDays(tenantId, date, null, client);

  const systemCash = await getSystemCashPaymentAccount(tenantId, client);
  const liveCashBalance = systemCash
    ? await resolvePaymentAccountBalance(tenantId, systemCash, client)
    : 0;

  const day = await client.posCashDay.findUnique({
    where: {
      tenantId_branchKey_businessDate: {
        tenantId,
        branchKey: POS_CASH_BRANCH_KEY,
        businessDate: date,
      },
    },
    include: {
      deposits: { orderBy: { createdAt: 'asc' }, include: { toAccount: { select: { id: true, name: true } } } },
      systemCashAccount: { select: { id: true, name: true, accountType: true } },
    },
  });

  const { totalCashSales, report } = await sumCashSalesForPosDay(
    tenantId,
    date,
    null,
    { branchIdsIn: null },
    systemCash?.id || ''
  );

  const opening = day ? Number(day.openingBalance || 0) : liveCashBalance;
  const depositsSum = day ? day.deposits.reduce((s, d) => s + Number(d.amount || 0), 0) : 0;
  const totalSales = Number(report?.totalSales ?? 0);
  const closingIfFormula = opening + totalSales;
  const cashInHandUndeposited = Math.max(0, opening + totalCashSales - depositsSum);
  const cashInHandUserMetric = totalCashSales - opening;

  return {
    businessDate: date,
    branchKey: POS_CASH_BRANCH_KEY,
    systemCashAccount: systemCash,
    liveCashBalance,
    register: day,
    report,
    companyName: report?.companyName,
    metrics: {
      openingBalance: day ? opening : liveCashBalance,
      totalSales,
      totalCashSales,
      depositsSum,
      closingBalance: day?.status === 'CLOSED' ? Number(day.closingBalanceAtClose ?? 0) : closingIfFormula,
      cashInHandUndeposited,
      cashInHandTotalCashMinusOpening: cashInHandUserMetric,
    },
  };
}
