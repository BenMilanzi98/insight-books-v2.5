import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { canUseCoaAccountPicker } from '@/lib/chartOfAccountsAccess';
import { computeCoaAccountBalanceBreakdown } from '@/lib/coaAccountBalanceBreakdown.js';

/**
 * GET /api/chart-of-accounts/picker/balance?accountId=
 * Lightweight GL balance for journal / picker UX (same permission as picker).
 */
export async function GET(request) {
  const accessError = await requireStandardAccess(request);
  if (accessError) return accessError;

  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    if (!canUseCoaAccountPicker(user)) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    const accountId = new URL(request.url).searchParams.get('accountId');
    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        tenantId: user.tenantId,
        mergedIntoAccountId: null,
        isActive: true,
      },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        code: true,
        name: true,
        accountType: true,
        type: true,
        normalBalance: true,
        parentAccountId: true,
        balance: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const glBranchFilter =
      user?.currentBranchId != null && String(user.currentBranchId).trim() !== ''
        ? { branchId: user.currentBranchId }
        : {};

    const breakdown = await computeCoaAccountBalanceBreakdown(prisma, user.tenantId, account, {
      glBranchFilter,
      inventoryUser: user,
    });

    return NextResponse.json({
      accountId: account.id,
      accountCode: account.accountCode ?? account.code ?? '',
      accountName: account.accountName ?? account.name ?? '',
      currentBalance: breakdown.displayedRowTotal ?? 0,
      normalBalance: breakdown.normalBalance ?? account.normalBalance ?? 'Debit',
      balanceSource: breakdown.balanceSource ?? null,
      postedGlNet: breakdown.postedGlNet ?? null,
    });
  } catch (error) {
    console.error('chart-of-accounts/picker/balance GET:', error);
    return NextResponse.json(
      { error: 'Failed to load account balance', hint: error?.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}
