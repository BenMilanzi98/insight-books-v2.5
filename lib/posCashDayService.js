/**
 * POS cash register: opening balance, deposits, day close.
 * Fresh-books V2: PosCashDay / PosCashDayDeposit are operational only.
 * Deposit does not mutate Account.balance / AccountBalance. When both sides
 * resolve to CoA accounts, GL moves via postBankTransferAccounting (V2);
 * otherwise no GL write (cash-day remains operational until banking is fully wired).
 */
import prisma from './prisma';
import {
  getSystemCashPaymentAccount,
  resolvePaymentAccountBalance,
} from './paymentAccountBalanceResolver';
import { sumCashSalesForPosDay } from './posDailyReportService';
import { formatYmdInTimeZone } from './dateUtils';
import {
  POS_TILL_SOURCE,
  assertFundingSourcesAvailable,
  buildCloseSweepLines,
  buildOpenFundingLines,
  posTillCloseSourceId,
  posTillOpenSourceId,
  splitTillFunding,
} from './posTillFunding.js';
import {
  ensurePosTillFloatPaymentAccount,
  POS_TILL_FLOAT_PA_NAME,
  POS_TILL_FLOAT_REFERENCE,
  resolveOwnerCapitalCoaAccount,
} from './posTillFloatAccounts.js';
import {
  posCashDaySupportsTillFloat,
  posCashDayWrite,
} from './posCashDaySchema.js';

function posCashDayUserConnect(userId) {
  return userId ? { connect: { id: userId } } : { disconnect: true };
}

function posCashDayCloseData({
  closedById,
  autoClosed,
  totalSales,
  closingBalance,
  totalCashSales,
  closeSweepJournalId,
}) {
  const data = {
    status: 'CLOSED',
    closedAt: new Date(),
    closedBy: posCashDayUserConnect(closedById),
    autoClosed: Boolean(autoClosed),
    totalSalesAtClose: totalSales,
    closingBalanceAtClose: closingBalance,
    totalCashSalesSnapshot: totalCashSales,
  };
  if (posCashDaySupportsTillFloat() && closeSweepJournalId !== undefined) {
    data.closeSweepJournalId = closeSweepJournalId;
  }
  return data;
}

export const POS_CASH_BRANCH_KEY = 'none';

/** Business calendar date for POS till (Africa/Blantyre). */
export function posBusinessDateToday() {
  return formatYmdInTimeZone(new Date(), 'Africa/Blantyre');
}

function todayYyyyMmDd() {
  return posBusinessDateToday();
}

/**
 * Hard-gate helper for sale create: requires an OPEN PosCashDay for the business date.
 * Historical sales skip this check.
 */
export async function assertPosTillOpenForSale(
  tenantId,
  { businessDate, isHistorical = false, client = prisma } = {}
) {
  if (isHistorical) return { ok: true, skipped: true };
  const date = businessDate || todayYyyyMmDd();
  await closeStalePosCashDays(tenantId, date, null, client);
  const day = await client.posCashDay.findUnique({
    where: {
      tenantId_branchKey_businessDate: {
        tenantId,
        branchKey: POS_CASH_BRANCH_KEY,
        businessDate: date,
      },
    },
    select: { id: true, status: true, businessDate: true, openingBalance: true },
  });
  if (!day || day.status !== 'OPEN') {
    const err = new Error(
      'POS till is not open for today. Open the till before making sales.'
    );
    err.code = 'TILL_NOT_OPEN';
    err.businessDate = date;
    err.registerStatus = day?.status || null;
    throw err;
  }
  return { ok: true, register: day };
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

  const totalSales = Number(report?.totalSales ?? 0);
  const closingBalance = opening + totalSales;
  const actorId = closedById || posCashDay.openedById || null;
  let closeSweepJournalId = posCashDaySupportsTillFloat()
    ? posCashDay.closeSweepJournalId || null
    : null;

  let tillPa = null;
  if (posCashDaySupportsTillFloat()) {
    tillPa =
      (posCashDay.tillFloatAccountId &&
        (await client.paymentAccount.findFirst({
          where: { id: posCashDay.tillFloatAccountId, tenantId },
        }))) ||
      (await ensurePosTillFloatPaymentAccount(tenantId, client));
  }

  let tillBal = 0;
  if (tillPa?.coaAccountId && cashAcc?.coaAccountId) {
    tillBal = Number(await resolvePaymentAccountBalance(tenantId, tillPa, client)) || 0;
    if (tillBal > 0.0001 && !autoClosed && !actorId) {
      const err = new Error('Cannot close till: missing user for GL sweep.');
      err.code = 'CLOSE_USER_REQUIRED';
      throw err;
    }
  }

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

  if (tillPa?.coaAccountId && cashAcc?.coaAccountId && tillBal > 0.0001) {
    if (!actorId) {
      console.error('POS till close auto-sweep skipped: missing actor for GL posting.', {
        tenantId,
        posCashDayId: posCashDay.id,
        businessDate: posCashDay.businessDate,
      });
    } else {
      const { amount, lines } = buildCloseSweepLines({
        tillCoaId: tillPa.coaAccountId,
        cashCoaId: cashAcc.coaAccountId,
        amount: tillBal,
      });
      const { postBankTransferAccounting } = await import('./accountingV2/adapters/remainingAdapters.js');
      const journal = await postBankTransferAccounting({
        db: prisma,
        tenantId,
        userId: actorId,
        sourceType: POS_TILL_SOURCE.CLOSE,
        sourceId: posTillCloseSourceId(posCashDay.id, posCashDay.openCount || 1),
        amount,
        date: new Date(`${posCashDay.businessDate}T12:00:00.000Z`),
        description: `POS till close sweep ${posCashDay.businessDate}`,
        fromAccountId: tillPa.coaAccountId,
        toAccountId: cashAcc.coaAccountId,
        lines,
      });
      closeSweepJournalId = journal?.id || journal?.journalEntryId || null;
    }
  }

  await posCashDayWrite(client, 'update', {
    where: { id: posCashDay.id },
    data: posCashDayCloseData({
      closedById,
      autoClosed,
      totalSales,
      closingBalance,
      totalCashSales,
      closeSweepJournalId,
    }),
  });
}

function snapshotClosedPosCashDayState(day) {
  return {
    status: day.status,
    openingBalance: day.openingBalance,
    systemCashAccountId: day.systemCashAccountId,
    tillFloatAccountId: day.tillFloatAccountId ?? null,
    openedAt: day.openedAt,
    openedById: day.openedById ?? null,
    closedAt: day.closedAt ?? null,
    closedById: day.closedById ?? null,
    autoClosed: Boolean(day.autoClosed),
    totalSalesAtClose: day.totalSalesAtClose ?? null,
    closingBalanceAtClose: day.closingBalanceAtClose ?? null,
    totalCashSalesSnapshot: day.totalCashSalesSnapshot ?? null,
    closeSweepJournalId: day.closeSweepJournalId ?? null,
    openFundingJournalId: day.openFundingJournalId ?? null,
    fundingCashAmount: day.fundingCashAmount ?? null,
    fundingCapitalAmount: day.fundingCapitalAmount ?? null,
    openCount: day.openCount ?? 1,
    reopenedAt: day.reopenedAt ?? null,
  };
}

async function rollbackOpenPosCashDayFailure({ client, dayId, mode, closedSnapshot }) {
  try {
    if (mode === 'create') {
      await client.posCashDay.delete({
        where: { id: dayId },
      });
      return;
    }

    if (mode === 'reopen' && closedSnapshot) {
      await posCashDayWrite(client, 'update', {
        where: { id: dayId },
        data: {
          status: closedSnapshot.status || 'CLOSED',
          openingBalance: closedSnapshot.openingBalance,
          systemCashAccount: { connect: { id: closedSnapshot.systemCashAccountId } },
          ...(closedSnapshot.tillFloatAccountId
            ? { tillFloatAccount: { connect: { id: closedSnapshot.tillFloatAccountId } } }
            : { tillFloatAccount: { disconnect: true } }),
          openedAt: closedSnapshot.openedAt,
          openedBy: posCashDayUserConnect(closedSnapshot.openedById),
          closedAt: closedSnapshot.closedAt,
          closedBy: posCashDayUserConnect(closedSnapshot.closedById),
          autoClosed: closedSnapshot.autoClosed,
          totalSalesAtClose: closedSnapshot.totalSalesAtClose,
          closingBalanceAtClose: closedSnapshot.closingBalanceAtClose,
          totalCashSalesSnapshot: closedSnapshot.totalCashSalesSnapshot,
          closeSweepJournalId: closedSnapshot.closeSweepJournalId,
          openFundingJournalId: closedSnapshot.openFundingJournalId,
          fundingCashAmount: closedSnapshot.fundingCashAmount,
          fundingCapitalAmount: closedSnapshot.fundingCapitalAmount,
          openCount: closedSnapshot.openCount,
          reopenedAt: closedSnapshot.reopenedAt,
        },
      });
    }
  } catch (rollbackError) {
    rollbackError.posCashDayId = dayId;
    rollbackError.posCashDayMode = mode;
    console.error(
      'POS cash day open compensation failed:',
      {
        dayId,
        mode,
        error: rollbackError?.message || rollbackError,
      }
    );
    throw rollbackError;
  }
}

export async function openPosCashDay({
  tenantId,
  userId,
  businessDate,
  openingBalance: openingBalanceInput,
  client = prisma,
}) {
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

  let openingBalance = 0;
  if (openingBalanceInput !== undefined && openingBalanceInput !== null && openingBalanceInput !== '') {
    const n = Number(openingBalanceInput);
    if (!Number.isFinite(n) || n < 0) {
      const err = new Error('Opening balance must be a non-negative number.');
      err.code = 'INVALID_OPENING_BALANCE';
      throw err;
    }
    openingBalance = n;
  }

  const tillFloatEnabled = posCashDaySupportsTillFloat();
  if (openingBalance > 0 && !tillFloatEnabled) {
    const err = new Error(
      'POS till float funding requires a pending database update on the server. Ask your administrator to run prisma migrate deploy, then try again.'
    );
    err.code = 'MIGRATION_REQUIRED';
    throw err;
  }

  const systemCash = await getSystemCashPaymentAccount(tenantId, client);
  if (!systemCash) {
    throw new Error('System Cash payment account is missing. Open Payment Management to initialize accounts.');
  }

  let tillFloat = null;
  if (tillFloatEnabled) {
    tillFloat = await ensurePosTillFloatPaymentAccount(tenantId, client);
    if (!tillFloat?.coaAccountId) {
      const err = new Error('Till Float GL account could not be created or linked.');
      err.code = 'TILL_FLOAT_UNMAPPED';
      throw err;
    }
  }

  const cashBalance = await resolvePaymentAccountBalance(tenantId, systemCash, client);
  const { cashPart, capitalPart } = splitTillFunding(openingBalance, cashBalance);
  let capitalCoa = null;
  if (tillFloatEnabled && capitalPart > 0) {
    capitalCoa = await resolveOwnerCapitalCoaAccount(tenantId, client);
    assertFundingSourcesAvailable({ capitalPart, capitalCoaId: capitalCoa?.id });
  }

  const cashCoaId = systemCash.coaAccountId;
  if (tillFloatEnabled && openingBalance > 0 && cashPart > 0 && !cashCoaId) {
    const err = new Error('System Cash is not linked to Chart of Accounts.');
    err.code = 'CASH_COA_UNMAPPED';
    throw err;
  }

  let day;
  let openMutationMode = 'create';
  let closedSnapshot = null;
  if (existing?.status === 'CLOSED') {
    openMutationMode = 'reopen';
    closedSnapshot = snapshotClosedPosCashDayState(existing);
    day = await posCashDayWrite(client, 'update', {
      where: { id: existing.id },
      data: {
        status: 'OPEN',
        openingBalance,
        systemCashAccount: { connect: { id: systemCash.id } },
        ...(tillFloat?.id ? { tillFloatAccount: { connect: { id: tillFloat.id } } } : {}),
        openedAt: new Date(),
        openedBy: posCashDayUserConnect(userId),
        closedAt: null,
        closedBy: { disconnect: true },
        autoClosed: false,
        totalSalesAtClose: null,
        closingBalanceAtClose: null,
        totalCashSalesSnapshot: null,
        ...(tillFloatEnabled
          ? {
              closeSweepJournalId: null,
              openFundingJournalId: null,
              fundingCashAmount: null,
              fundingCapitalAmount: null,
              openCount: (existing.openCount || 1) + 1,
              reopenedAt: new Date(),
            }
          : {}),
      },
    });
  } else {
    day = await posCashDayWrite(client, 'create', {
      data: {
        tenantId,
        branchKey: POS_CASH_BRANCH_KEY,
        businessDate: date,
        status: 'OPEN',
        systemCashAccount: { connect: { id: systemCash.id } },
        ...(tillFloat?.id ? { tillFloatAccount: { connect: { id: tillFloat.id } } } : {}),
        openingBalance,
        ...(userId ? { openedBy: { connect: { id: userId } } } : {}),
        ...(tillFloatEnabled ? { openCount: 1 } : {}),
      },
    });
  }

  if (tillFloatEnabled && openingBalance > 0) {
    const { amount, lines } = buildOpenFundingLines({
      tillCoaId: tillFloat.coaAccountId,
      cashCoaId,
      capitalCoaId: capitalCoa?.id,
      cashPart,
      capitalPart,
    });
    const { postBankTransferAccounting } = await import('./accountingV2/adapters/remainingAdapters.js');
    const fundingSourceId = posTillOpenSourceId(day.id, day.openCount);
    let journal = null;
    try {
      journal = await postBankTransferAccounting({
        db: prisma,
        tenantId,
        userId,
        sourceType: POS_TILL_SOURCE.OPEN,
        sourceId: fundingSourceId,
        amount,
        date: new Date(`${date}T12:00:00.000Z`),
        description: `POS till open float ${date}`,
        fromAccountId: cashPart > 0 ? cashCoaId : capitalCoa?.id,
        toAccountId: tillFloat.coaAccountId,
        lines,
      });
      const journalId = journal?.id || journal?.journalEntryId || null;
      day = await posCashDayWrite(client, 'update', {
        where: { id: day.id },
        data: {
          openFundingJournalId: journalId,
          fundingCashAmount: cashPart,
          fundingCapitalAmount: capitalPart,
        },
        include: {
          systemCashAccount: { select: { id: true, name: true, accountType: true } },
          deposits: true,
        },
      });
    } catch (error) {
      const openError = error instanceof Error ? error : new Error(error?.message || 'POS till open funding failed');
      openError.posCashDayId = day.id;
      openError.posCashDayMode = openMutationMode;
      let compensationError = null;
      try {
        await rollbackOpenPosCashDayFailure({
          client,
          dayId: day.id,
          mode: openMutationMode,
          closedSnapshot,
        });
      } catch (rollbackError) {
        compensationError = rollbackError;
        openError.compensationFailed = true;
        openError.compensationError = rollbackError;
        openError.message = `${openError.message} Compensation failed for POS cash day ${day.id} (${openMutationMode}).`;
      }
      const journalId = typeof journal !== 'undefined' ? journal?.id || journal?.journalEntryId || null : null;
      if (journalId) {
        openError.orphanFundingJournalPossible = true;
        openError.orphanFundingJournalSourceId = fundingSourceId;
        openError.message = `${openError.message} Operator review may be required: a funding journal may exist with sourceId ${fundingSourceId}.`;
        console.error(
          compensationError
            ? 'POS cash day open funding journal may be orphaned after failed compensation attempt:'
            : 'POS cash day open funding journal may be orphaned after rollback:',
          {
            dayId: day.id,
            mode: openMutationMode,
            journalId,
            sourceId: fundingSourceId,
          }
        );
      }
      throw openError;
    }
  } else {
    day = await client.posCashDay.findUnique({
      where: { id: day.id },
      include: {
        systemCashAccount: { select: { id: true, name: true, accountType: true } },
        deposits: true,
      },
    });
  }

  return day;
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
      const deposit = await tx.posCashDayDeposit.create({
        data: {
          posCashDayId: day.id,
          toAccountId: toId,
          amount: amt,
          notes: line.notes || null,
          isAutoSweep: false,
          createdById: userId || null,
        },
      });

      // Operational deposit recorded above. Optional V2 GL when CoA links exist.
      // No Account.balance / AccountBalance mutations (fresh-books).
      try {
        const [fromPa, toPa] = await Promise.all([
          tx.paymentAccount.findFirst({
            where: { id: systemCashId, tenantId },
            select: { coaAccountId: true },
          }),
          tx.paymentAccount.findFirst({
            where: { id: toId, tenantId },
            select: { coaAccountId: true },
          }),
        ]);
        if (fromPa?.coaAccountId && toPa?.coaAccountId && userId) {
          const { postBankTransferAccounting } = await import(
            './accountingV2/adapters/remainingAdapters.js'
          );
          const glLines = [
            {
              lineNumber: 1,
              accountId: toPa.coaAccountId,
              debitAmount: amt,
              creditAmount: 0,
              description: 'POS cash deposit in',
            },
            {
              lineNumber: 2,
              accountId: fromPa.coaAccountId,
              debitAmount: 0,
              creditAmount: amt,
              description: 'POS cash deposit out',
            },
          ];
          // postBankTransferAccounting opens its own posting boundary — use root prisma.
          await postBankTransferAccounting({
            db: prisma,
            tenantId,
            userId,
            sourceType: 'PosCashDeposit',
            sourceId: deposit.id,
            amount: amt,
            date: new Date(`${date}T12:00:00.000Z`),
            description: line.notes || `POS cash deposit ${date}`,
            fromAccountId: fromPa.coaAccountId,
            toAccountId: toPa.coaAccountId,
            lines: glLines,
          });
        }
        // else: cash-day deposit is operational only until both payment accounts have CoA links
      } catch (glErr) {
        console.error('POS cash deposit V2 GL failed (operational deposit kept):', glErr?.message || glErr);
      }
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

  const tillOpen = day?.status === 'OPEN';
  const tillClosed = day?.status === 'CLOSED';

  const tillFloat = await client.paymentAccount.findFirst({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { reference: POS_TILL_FLOAT_REFERENCE },
        { name: POS_TILL_FLOAT_PA_NAME, isSystem: true },
      ],
    },
    select: { id: true, name: true },
  });

  return {
    businessDate: date,
    branchKey: POS_CASH_BRANCH_KEY,
    systemCashAccount: systemCash,
    liveCashBalance,
    register: day,
    report,
    companyName: report?.companyName,
    /** Hard-gate flags for /pos */
    tillOpen,
    tillClosed,
    requiresTillOpen: !tillOpen,
    suggestedOpeningBalance: liveCashBalance,
    tillFloatAccount: tillFloat ? { id: tillFloat.id, name: tillFloat.name } : null,
    canReopen: tillClosed,
    fundingPreview: {
      cashAvailable: liveCashBalance,
      capitalFallback: true,
      note:
        'Entered float is funded from Cash first; any shortfall comes from Owner Capital.',
    },
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
