import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { ensureChartOfAccountsForTenant } from '@/lib/chartOfAccountsInitialization';

const isFinanceAdmin = (user) => {
  const roleName = user?.role?.name?.toLowerCase() || '';
  return roleName.includes('finance') || roleName.includes('admin') || roleName === 'master_admin';
};

/**
 * POST /api/chart-of-accounts/bootstrap
 * Creates/updates the standard baseline chart of accounts (hierarchy + codes) for the tenant.
 */
export async function POST() {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!isFinanceAdmin(user)) {
      return NextResponse.json(
        { error: 'Access denied. Finance or Admin role required.' },
        { status: 403 }
      );
    }

    await ensureChartOfAccountsForTenant(user.tenantId);
    const accountCount = await prisma.account.count({
      where: { tenantId: user.tenantId },
    });

    return NextResponse.json({
      success: true,
      message: 'Standard chart of accounts applied.',
      accountCount,
    });
  } catch (error) {
    console.error('chart-of-accounts bootstrap:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize chart of accounts' },
      { status: 500 }
    );
  }
}
