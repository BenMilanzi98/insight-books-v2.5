import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { initializeNewTenantFinancialDefaults } from '@/lib/initializeNewTenantFinancialDefaults';
import { canBootstrapChartOfAccounts } from '@/lib/chartOfAccountsAccess';

/**
 * POST /api/chart-of-accounts/bootstrap
 * Applies the same setup as new-tenant onboarding when anything was skipped:
 * baseline chart of accounts, default payment accounts (+ COA links), default tax GL accounts, current month period.
 */
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!canBootstrapChartOfAccounts(user)) {
      return NextResponse.json(
        {
          error:
            'Access denied. accounts.create or accounts.update permission required.',
        },
        { status: 403 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await initializeNewTenantFinancialDefaults(user.tenantId, tx, {
        preferSystemCoaDefinition: false,
      });
    });

    const [accountCount, paymentAccountCount] = await Promise.all([
      prisma.account.count({ where: { tenantId: user.tenantId } }),
      prisma.paymentAccount.count({ where: { tenantId: user.tenantId } }),
    ]);

    return NextResponse.json({
      success: true,
      message:
        'Standard financial setup applied: chart of accounts, default payment accounts, and tax accounts (where missing).',
      accountCount,
      paymentAccountCount,
    });
  } catch (error) {
    console.error('chart-of-accounts bootstrap:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize chart of accounts' },
      { status: 500 }
    );
  }
}
