// app/api/accounts/reconcile/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { recalculateAllAccountBalances, recalculateAccountBalance } from '@/lib/accountBalanceService';

// POST - Reconcile account balances
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { accountId } = body;

    if (accountId) {
      // Recalculate single account
      const balance = await recalculateAccountBalance(accountId, user.tenantId);
      return NextResponse.json({
        success: true,
        message: 'Account balance recalculated successfully',
        data: {
          accountId,
          balance
        }
      });
    } else {
      // Recalculate all accounts
      const results = await recalculateAllAccountBalances(user.tenantId);
      return NextResponse.json({
        success: true,
        message: 'All account balances recalculated',
        data: results
      });
    }
  } catch (error) {
    console.error('Error reconciling account balances:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reconcile account balances' },
      { status: 500 }
    );
  }
}










