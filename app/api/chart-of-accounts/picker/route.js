import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { canUseCoaAccountPicker } from '@/lib/chartOfAccountsAccess';
import { buildCoaAccountListWhere } from '@/lib/coaAccountListWhere.js';
import { accountBlocksDirectPosting } from '@/lib/coaDirectPostingEligibility.js';

/**
 * GET /api/chart-of-accounts/picker
 * Lightweight GL account list for dropdowns — same row scope as Chart of Accounts filters,
 * without rollups, balances, or synthetic rows. Usable with budgets / journal / GL / payroll / rentals
 * permissions (see {@link canUseCoaAccountPicker}).
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
      return NextResponse.json(
        { error: 'Access denied. You do not have permission to load account lists for this action.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const where = buildCoaAccountListWhere(user.tenantId, searchParams);
    const postingEligibleOnly =
      searchParams.get('postingEligibleOnly') === 'true' ||
      searchParams.get('postingEligibleOnly') === '1';

    const rows = await prisma.account.findMany({
      where,
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        code: true,
        name: true,
        type: true,
        accountType: true,
        parentAccountId: true,
        isActive: true,
        normalBalance: true,
        isSystem: true,
        mergedIntoAccountId: true,
        visibleInChart: true,
        ...(postingEligibleOnly
          ? {
              acceptsNewTransactions: true,
              _count: {
                select: {
                  childAccounts: { where: { isActive: true } },
                },
              },
            }
          : {}),
        parentAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: [{ accountCode: 'asc' }],
    });

    let mapped = rows.map((acc) => ({
      ...acc,
      code: acc.code ?? acc.accountCode ?? '',
      name: acc.name ?? acc.accountName ?? '',
      accountCode: acc.accountCode ?? acc.code ?? '',
      accountName: acc.accountName ?? acc.name ?? '',
    }));

    if (postingEligibleOnly) {
      mapped = mapped.filter((acc) => !accountBlocksDirectPosting(acc).blocked);
    }

    const accounts = mapped;

    return NextResponse.json(
      { accounts, total: accounts.length },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('chart-of-accounts/picker GET:', error);
    return NextResponse.json({ error: 'Failed to load accounts' }, { status: 500 });
  }
}
