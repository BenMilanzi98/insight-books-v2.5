// app/api/chart-of-accounts/income-accounts/route.js
// Lightweight endpoint for POS to fetch income accounts without Finance/Admin requirement
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { canAccessPosIncomeAccounts } from '@/lib/chartOfAccountsAccess';
import {
  findCoaPostableIncomeAccountsForTenant,
  pickDefaultPostableIncomeAccount,
} from '@/lib/coaIncomeAccounts';

// GET - Fetch income accounts for POS (no Finance/Admin requirement)
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!canAccessPosIncomeAccounts(user)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const accounts = await findCoaPostableIncomeAccountsForTenant(prisma, user.tenantId, {
      id: true,
      accountCode: true,
      code: true,
      accountName: true,
      accountType: true,
      type: true,
      isActive: true,
    });
    const defaultAccount = pickDefaultPostableIncomeAccount(accounts);

    return NextResponse.json({
      accounts,
      count: accounts.length,
      defaultAccountId: defaultAccount?.id ?? null,
    });
  } catch (error) {
    console.error('Error fetching income accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch income accounts', details: error.message },
      { status: 500 }
    );
  }
}
