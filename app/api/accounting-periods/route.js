import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  getCurrentPeriod,
  normalizePeriodType,
  PERIOD_TYPES,
  getTenantFiscalYearStartMonth,
  startOfFinancialYearForDate,
  endOfFinancialYearForDate,
} from '@/lib/accountingPeriodService';
import { startOfMonth, endOfMonth } from '@/lib/dateUtils';

function isFinanceAdmin(user) {
  if (!user || !user.role) {
    return false;
  }
  const roleName = (user.role.name || '').toLowerCase();
  return (
    roleName.includes('finance') ||
    roleName.includes('admin') ||
    roleName === 'master_admin'
  );
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Yearly range follows tenant fiscal year start month; monthly = calendar month. */
function computePeriodRange(periodType, startDate, fiscalStartMonth) {
  if (periodType === 'Yearly') {
    const start = startOfDay(startOfFinancialYearForDate(startDate, fiscalStartMonth));
    const end = endOfFinancialYearForDate(startDate, fiscalStartMonth);
    return { start, end };
  }
  const start = startOfDay(startOfMonth(startDate));
  const end = endOfDay(endOfMonth(startDate));
  return { start, end };
}

function buildPeriodName(periodType, startDate) {
  const year = startDate.getFullYear();
  if (periodType === 'Yearly') {
    return `FY ${year}`;
  }
  const month = startDate.toLocaleString('en-US', { month: 'short' });
  return `${month} ${year}`;
}

export async function GET(request) {
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

    let periods = [];
    try {
      periods = await prisma.accountingPeriod.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { startDate: 'desc' },
      });
    } catch (periodsError) {
      console.error('Error fetching periods:', periodsError);
      // Return empty array if query fails
      periods = [];
    }

    let currentPeriod = null;
    try {
      currentPeriod = await getCurrentPeriod(user.tenantId, prisma);
    } catch (periodError) {
      console.warn('Error getting current period (non-fatal):', periodError);
      // Continue without currentPeriod if there's an error
    }

    return NextResponse.json({ periods, currentPeriod });
  } catch (error) {
    console.error('Error fetching accounting periods:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    
    // Provide more detailed error information in development
    const errorResponse = {
      error: 'Failed to load accounting periods',
      details: error.message || 'Unknown error'
    };
    
    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = error.stack;
      errorResponse.name = error.name;
      errorResponse.code = error.code;
    }
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function POST(request) {
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

    const body = await request.json().catch(() => ({}));
    const periodType = normalizePeriodType(body.periodType);

    if (!PERIOD_TYPES.includes(periodType)) {
      return NextResponse.json(
        { error: `Invalid period type. Expected one of: ${PERIOD_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const fiscalStartMonth = await getTenantFiscalYearStartMonth(user.tenantId, prisma);

    let startDate = body.startDate ? new Date(body.startDate) : null;
    let endDate = body.endDate ? new Date(body.endDate) : null;

    if (!startDate || Number.isNaN(startDate.getTime())) {
      const latestPeriod = await prisma.accountingPeriod.findFirst({
        where: { tenantId: user.tenantId },
        orderBy: { endDate: 'desc' },
      });

      if (latestPeriod) {
        const nextDay = new Date(latestPeriod.endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        if (periodType === 'Yearly') {
          startDate = startOfDay(startOfFinancialYearForDate(nextDay, fiscalStartMonth));
        } else {
          startDate = nextDay;
        }
      } else {
        const now = new Date();
        startDate =
          periodType === 'Yearly'
            ? startOfDay(startOfFinancialYearForDate(now, fiscalStartMonth))
            : new Date(now.getFullYear(), now.getMonth(), 1);
      }
    } else if (periodType === 'Yearly') {
      startDate = startOfDay(startOfFinancialYearForDate(startDate, fiscalStartMonth));
    } else if (periodType === 'Monthly') {
      // Enforce: monthly period always starts on 1st of the month
      startDate = startOfMonth(startDate);
    }

    if (!endDate || Number.isNaN(endDate.getTime())) {
      const range = computePeriodRange(periodType, startDate, fiscalStartMonth);
      startDate = range.start;
      endDate = range.end;
    } else {
      endDate = endOfDay(endDate);
      if (periodType === 'Yearly') {
        startDate = startOfDay(startOfFinancialYearForDate(startDate, fiscalStartMonth));
        endDate = endOfFinancialYearForDate(startDate, fiscalStartMonth);
      } else if (periodType === 'Monthly') {
        startDate = startOfDay(startOfMonth(startDate));
        endDate = endOfDay(endOfMonth(endDate));
      } else {
        startDate = startOfDay(startDate);
      }
    }

    const overlap = await prisma.accountingPeriod.findFirst({
      where: {
        tenantId: user.tenantId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (overlap) {
      return NextResponse.json(
        {
          error: 'Accounting period overlaps with an existing period.',
          details: `Overlap with ${overlap.name} (${overlap.startDate.toISOString().split('T')[0]} - ${overlap.endDate.toISOString().split('T')[0]})`,
        },
        { status: 400 }
      );
    }

    const period = await prisma.accountingPeriod.create({
      data: {
        tenantId: user.tenantId,
        name: body.name || buildPeriodName(periodType, startDate),
        periodType,
        startDate,
        endDate,
        status: 'open',
      },
    });

    // Carry forward balances from the latest closed period, if available
    const lastClosed = await prisma.accountingPeriod.findFirst({
      where: {
        tenantId: user.tenantId,
        status: 'closed',
        endDate: { lt: startDate },
      },
      orderBy: { endDate: 'desc' },
    });

    if (lastClosed) {
      // First, get all account IDs for this tenant
      const tenantAccounts = await prisma.account.findMany({
        where: { tenantId: user.tenantId },
        select: { id: true },
      });
      const accountIds = tenantAccounts.map((acc) => acc.id);

      if (accountIds.length > 0) {
        // Then get balance history for those accounts
        const lastBalances = await prisma.accountBalanceHistory.findMany({
          where: {
            periodDate: lastClosed.endDate,
            accountId: { in: accountIds },
          },
        });

        if (lastBalances.length > 0) {
          await prisma.accountBalanceHistory.createMany({
            data: lastBalances.map((balance) => ({
              accountId: balance.accountId,
              periodDate: startDate,
              openingBalance: balance.closingBalance,
              totalDebits: 0,
              totalCredits: 0,
              closingBalance: balance.closingBalance,
            })),
            skipDuplicates: true,
          });
        }
      }
    }

    return NextResponse.json({ period }, { status: 201 });
  } catch (error) {
    console.error('Error creating accounting period:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    
    // Provide more detailed error information in development
    const errorResponse = {
      error: 'Failed to create accounting period',
      details: error.message || 'Unknown error'
    };
    
    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = error.stack;
      errorResponse.name = error.name;
      errorResponse.code = error.code;
      if (error.meta) {
        errorResponse.meta = error.meta;
      }
    }
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
