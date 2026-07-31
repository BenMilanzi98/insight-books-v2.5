import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardEquityRoute, accountingErrorResponse } from '@/lib/equityManagement/api/routeGuard.js';
import { EQUITY_PERMISSIONS } from '@/lib/equityManagement/permissions.js';
import {
  createEquityTransaction,
  listEquityTransactions,
} from '@/lib/equityManagement/application/transactionService.js';

export async function GET(request) {
  const guard = await guardEquityRoute(request, [
    EQUITY_PERMISSIONS.VIEW,
    EQUITY_PERMISSIONS.VIEW_CONTRIBUTIONS,
  ]);
  if (guard.response) return guard.response;
  try {
    const { searchParams } = new URL(request.url);
    const transactions = await listEquityTransactions(prisma, guard.context.businessId, {
      transactionType: searchParams.get('transactionType') || undefined,
      status: searchParams.get('status') || undefined,
      relationshipId: searchParams.get('relationshipId') || undefined,
    });
    return NextResponse.json({ transactions });
  } catch (error) {
    return accountingErrorResponse(error, 'list equity transactions');
  }
}

export async function POST(request) {
  const guard = await guardEquityRoute(request, [
    EQUITY_PERMISSIONS.CREATE_CONTRIBUTION,
    EQUITY_PERMISSIONS.CREATE_DRAWING,
    EQUITY_PERMISSIONS.ISSUE_SHARES,
    EQUITY_PERMISSIONS.DECLARE_DIVIDEND,
  ]);
  if (guard.response) return guard.response;
  try {
    const body = await request.json();
    const transaction = await createEquityTransaction(prisma, guard.context, body);
    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    return accountingErrorResponse(error, 'create equity transaction');
  }
}
