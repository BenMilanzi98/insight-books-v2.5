import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilterIncludeUnassigned } from '@/lib/dashboardBranchFilter';

function parseDateAtStart(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDateAtEnd(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(23, 59, 59, 999);
  return date;
}

function getEventTypeFromReference(originalReference = '') {
  if (originalReference.startsWith('inventory-writeoff:')) return 'write_off';
  if (originalReference.startsWith('inventory-stockout:')) return 'stock_out';
  return 'unknown';
}

function getSourceIdFromReference(originalReference = '') {
  const idx = originalReference.indexOf(':');
  if (idx < 0) return null;
  return originalReference.slice(idx + 1) || null;
}

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const eventType = (searchParams.get('eventType') || 'all').toLowerCase();

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    const start = parseDateAtStart(startDate);
    const end = parseDateAtEnd(endDate);
    if (!start || !end) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }
    if (start > end) {
      return NextResponse.json(
        { error: 'Start date cannot be after end date.' },
        { status: 400 }
      );
    }

    const allowedTypes = new Set(['all', 'write_off', 'stock_out']);
    if (!allowedTypes.has(eventType)) {
      return NextResponse.json(
        { error: 'Invalid eventType. Use all, write_off, or stock_out.' },
        { status: 400 }
      );
    }

    const whereBase = addBranchFilterIncludeUnassigned(user, {
      tenantId: user.tenantId,
      status: 'Approved',
      isDeleted: false,
      isReversal: false,
      date: {
        gte: start,
        lte: end,
      },
      OR: [
        { originalReference: { startsWith: 'inventory-writeoff:' } },
        { originalReference: { startsWith: 'inventory-stockout:' } },
      ],
    });

    const expenses = await prisma.expense.findMany({
      where: whereBase,
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
        originalReference: true,
        createdAt: true,
        notes: true,
        category: true,
        branch: {
          select: { id: true, name: true },
        },
        submittedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const items = expenses
      .map((expense) => {
        const derivedType = getEventTypeFromReference(expense.originalReference || '');
        return {
          id: expense.id,
          date: expense.date,
          eventType: derivedType,
          sourceId: getSourceIdFromReference(expense.originalReference || ''),
          reference: expense.originalReference || null,
          description: expense.description || 'Inventory adjustment loss',
          amount: Number(expense.amount || 0),
          category: expense.category || 'Inventory Adjustment Loss',
          branchName: expense.branch?.name || 'Unassigned',
          branchId: expense.branch?.id || null,
          submittedBy: expense.submittedBy?.name || 'Unknown',
          notes: expense.notes || null,
        };
      })
      .filter((item) => (eventType === 'all' ? true : item.eventType === eventType));

    const summary = items.reduce(
      (acc, item) => {
        const amount = Number(item.amount || 0);
        acc.totalAmount += amount;
        acc.totalCount += 1;
        if (item.eventType === 'write_off') {
          acc.writeOffAmount += amount;
          acc.writeOffCount += 1;
        } else if (item.eventType === 'stock_out') {
          acc.stockOutAmount += amount;
          acc.stockOutCount += 1;
        }
        return acc;
      },
      {
        totalAmount: 0,
        totalCount: 0,
        writeOffAmount: 0,
        writeOffCount: 0,
        stockOutAmount: 0,
        stockOutCount: 0,
      }
    );

    const byMonthMap = new Map();
    for (const item of items) {
      const key = new Date(item.date).toISOString().slice(0, 7);
      if (!byMonthMap.has(key)) {
        byMonthMap.set(key, { month: key, writeOffAmount: 0, stockOutAmount: 0, totalAmount: 0, count: 0 });
      }
      const row = byMonthMap.get(key);
      row.totalAmount += item.amount;
      row.count += 1;
      if (item.eventType === 'write_off') row.writeOffAmount += item.amount;
      if (item.eventType === 'stock_out') row.stockOutAmount += item.amount;
    }

    return NextResponse.json({
      period: { startDate, endDate },
      filters: { eventType },
      summary,
      byMonth: Array.from(byMonthMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
      items,
    });
  } catch (error) {
    console.error('Error generating inventory loss report:', error);
    return NextResponse.json(
      { error: 'Failed to generate inventory loss report. Please try again.' },
      { status: 500 }
    );
  }
}
