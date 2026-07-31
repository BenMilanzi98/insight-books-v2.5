import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { addBranchFilterIncludeUnassigned } from '@/lib/dashboardBranchFilter';
import { applyExpenseTextSearchToWhere } from '@/lib/applyExpenseTextSearchToWhere';
import { buildExpenseWorkbookBuffer } from '@/lib/expenses/expenseExcelExport.js';

function buildExpenseWhere(user, searchParams) {
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const accountId = searchParams.get('accountId');
  const search = searchParams.get('search');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const branchIdParam = searchParams.get('branchId');

  const where = {
    tenantId: user.tenantId,
    isDeleted: false,
  };

  if (branchIdParam) {
    where.branchId = branchIdParam;
  } else {
    addBranchFilterIncludeUnassigned(user, where);
  }

  if (status && status !== 'all') where.status = status;
  if (accountId && accountId !== 'all') where.expenseAccountId = accountId;
  if (category && category !== 'all') where.category = category;

  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo);
  }

  applyExpenseTextSearchToWhere(where, search);
  return where;
}

async function handleExport(request) {
  const perm = await requirePermission(request, 'expenses.view');
  if (perm) return perm;

  const accessError = await requireStandardAccess(request);
  if (accessError) return accessError;

  const user = await getUserFromSession(request);
  if (!user?.tenantId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const where = buildExpenseWhere(user, searchParams);

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      expenseAccount: {
        select: {
          id: true,
          accountCode: true,
          code: true,
          accountName: true,
          name: true,
        },
      },
    },
  });

  const expenseIds = expenses.map((e) => e.id);
  const payments = expenseIds.length
    ? await prisma.payment.findMany({
        where: {
          tenantId: user.tenantId,
          expenseId: { in: expenseIds },
          type: 'expense',
        },
        orderBy: { paymentDate: 'asc' },
      })
    : [];

  const buffer = await buildExpenseWorkbookBuffer({
    tenantId: user.tenantId,
    expenses,
    payments,
    meta: {
      exportedAt: new Date().toISOString(),
      exportedBy: user.email || user.id,
      formatVersion: '1.0',
    },
  });

  const filename = `expenses-backup-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/** GET /api/expenses/export-xlsx — filter via query string */
export async function GET(request) {
  try {
    return await handleExport(request);
  } catch (error) {
    console.error('expense export-xlsx GET:', error);
    return NextResponse.json(
      { error: 'Failed to export expenses workbook' },
      { status: 500 }
    );
  }
}

/** POST /api/expenses/export-xlsx — same filters (query or JSON body filters) */
export async function POST(request) {
  try {
    return await handleExport(request);
  } catch (error) {
    console.error('expense export-xlsx POST:', error);
    return NextResponse.json(
      { error: 'Failed to export expenses workbook' },
      { status: 500 }
    );
  }
}
