import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

const FLOAT_TOLERANCE = 0.0001;

function isFinanceAdmin(user) {
  const roleName = user?.role?.name?.toLowerCase() || '';
  return (
    roleName.includes('finance') ||
    roleName.includes('admin') ||
    roleName === 'master_admin'
  );
}

function computeBalance(account, totals) {
  const debits = totals.debits || 0;
  const credits = totals.credits || 0;
  if (account.accountType === 'Asset' || account.accountType === 'Expense') {
    return debits - credits;
  }
  if (account.accountType === 'Liability' || account.accountType === 'Equity' || account.accountType === 'Revenue') {
    return credits - debits;
  }
  if (account.normalBalance === 'Debit') {
    return debits - credits;
  }
  return credits - debits;
}

function mapTotals(rows) {
  const map = new Map();
  rows.forEach((row) => {
    map.set(row.accountId, {
      debits: row._sum?.debitAmount || 0,
      credits: row._sum?.creditAmount || 0,
    });
  });
  return map;
}

export async function POST(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }

    if (!isFinanceAdmin(user)) {
      return NextResponse.json(
        { error: 'Access denied. Finance or Admin role required.' },
        { status: 403 }
      );
    }

    const resolvedParams = typeof params.then === 'function' ? await params : params;
    const periodId = resolvedParams?.id;
    if (!periodId) {
      return NextResponse.json({ error: 'Invalid period ID' }, { status: 400 });
    }

    const period = await prisma.accountingPeriod.findFirst({
      where: { id: periodId, tenantId: user.tenantId },
    });

    if (!period) {
      return NextResponse.json({ error: 'Accounting period not found' }, { status: 404 });
    }

    if (period.status === 'closed') {
      return NextResponse.json({ message: 'Accounting period already closed.' });
    }

    const [draftTransactions, draftJournalEntries] = await Promise.all([
      prisma.transaction.count({
        where: {
          tenantId: user.tenantId,
          status: { not: 'posted' },
          date: { gte: period.startDate, lte: period.endDate },
        },
      }),
      prisma.journalEntry.count({
        where: {
          tenantId: user.tenantId,
          status: { not: 'Posted' },
          entryDate: { gte: period.startDate, lte: period.endDate },
        },
      }),
    ]);

    if (draftTransactions > 0 || draftJournalEntries > 0) {
      return NextResponse.json(
        {
          error: 'Draft entries exist in this period. Please post or remove drafts before closing.',
          details: `Draft transactions: ${draftTransactions}, draft journal entries: ${draftJournalEntries}`,
        },
        { status: 400 }
      );
    }

    const [txnTotals, journalTotals] = await Promise.all([
      prisma.transactionLine.aggregate({
        where: {
          transaction: {
            tenantId: user.tenantId,
            status: 'posted',
            date: { gte: period.startDate, lte: period.endDate },
          },
        },
        _sum: { debitAmount: true, creditAmount: true },
      }),
      prisma.journalEntryLine.aggregate({
        where: {
          journalEntry: {
            tenantId: user.tenantId,
            status: 'Posted',
            entryDate: { gte: period.startDate, lte: period.endDate },
          },
        },
        _sum: { debitAmount: true, creditAmount: true },
      }),
    ]);

    const totalDebits =
      (txnTotals._sum?.debitAmount || 0) + (journalTotals._sum?.debitAmount || 0);
    const totalCredits =
      (txnTotals._sum?.creditAmount || 0) + (journalTotals._sum?.creditAmount || 0);

    if (Math.abs(totalDebits - totalCredits) > FLOAT_TOLERANCE) {
      return NextResponse.json(
        {
          error: 'Period does not balance. Debits must equal credits before closing.',
          details: `Debits: ${totalDebits}, Credits: ${totalCredits}`,
        },
        { status: 400 }
      );
    }

    const [accounts, beforeTxn, beforeJournal, periodTxn, periodJournal] = await Promise.all([
      prisma.account.findMany({
        where: { tenantId: user.tenantId },
        select: { id: true, accountType: true, normalBalance: true },
      }),
      prisma.transactionLine.groupBy({
        by: ['accountId'],
        where: {
          transaction: {
            tenantId: user.tenantId,
            status: 'posted',
            date: { lt: period.startDate },
          },
        },
        _sum: { debitAmount: true, creditAmount: true },
      }),
      prisma.journalEntryLine.groupBy({
        by: ['accountId'],
        where: {
          journalEntry: {
            tenantId: user.tenantId,
            status: 'Posted',
            entryDate: { lt: period.startDate },
          },
        },
        _sum: { debitAmount: true, creditAmount: true },
      }),
      prisma.transactionLine.groupBy({
        by: ['accountId'],
        where: {
          transaction: {
            tenantId: user.tenantId,
            status: 'posted',
            date: { gte: period.startDate, lte: period.endDate },
          },
        },
        _sum: { debitAmount: true, creditAmount: true },
      }),
      prisma.journalEntryLine.groupBy({
        by: ['accountId'],
        where: {
          journalEntry: {
            tenantId: user.tenantId,
            status: 'Posted',
            entryDate: { gte: period.startDate, lte: period.endDate },
          },
        },
        _sum: { debitAmount: true, creditAmount: true },
      }),
    ]);

    const beforeTxnMap = mapTotals(beforeTxn);
    const beforeJournalMap = mapTotals(beforeJournal);
    const periodTxnMap = mapTotals(periodTxn);
    const periodJournalMap = mapTotals(periodJournal);

    const historyData = accounts.map((account) => {
      const beforeTotals = {
        debits:
          (beforeTxnMap.get(account.id)?.debits || 0) +
          (beforeJournalMap.get(account.id)?.debits || 0),
        credits:
          (beforeTxnMap.get(account.id)?.credits || 0) +
          (beforeJournalMap.get(account.id)?.credits || 0),
      };

      const periodTotals = {
        debits:
          (periodTxnMap.get(account.id)?.debits || 0) +
          (periodJournalMap.get(account.id)?.debits || 0),
        credits:
          (periodTxnMap.get(account.id)?.credits || 0) +
          (periodJournalMap.get(account.id)?.credits || 0),
      };

      const openingBalance = computeBalance(account, beforeTotals);
      const closingBalance = computeBalance(account, {
        debits: beforeTotals.debits + periodTotals.debits,
        credits: beforeTotals.credits + periodTotals.credits,
      });

      return {
        accountId: account.id,
        periodDate: period.endDate,
        openingBalance,
        totalDebits: periodTotals.debits,
        totalCredits: periodTotals.credits,
        closingBalance,
      };
    });

    const closedPeriod = await prisma.$transaction(async (tx) => {
      await tx.accountBalanceHistory.createMany({
        data: historyData,
        skipDuplicates: true,
      });

      const updatedPeriod = await tx.accountingPeriod.update({
        where: { id: period.id },
        data: {
          status: 'closed',
          closedAt: new Date(),
          closedById: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'ACCOUNTING_PERIOD_CLOSED',
          entityType: 'AccountingPeriod',
          entityId: period.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            periodName: period.name,
            startDate: period.startDate,
            endDate: period.endDate,
            totalDebits,
            totalCredits,
          }),
        },
      });

      return updatedPeriod;
    });

    return NextResponse.json({
      message: 'Accounting period closed successfully.',
      period: closedPeriod,
      totals: { debits: totalDebits, credits: totalCredits },
    });
  } catch (error) {
    console.error('Error closing accounting period:', error);
    return NextResponse.json(
      { error: 'Failed to close accounting period', details: error.message },
      { status: 500 }
    );
  }
}
