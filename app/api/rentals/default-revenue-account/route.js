import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { getDefaultRentalRevenueAccount } from '@/lib/defaultRentalRevenueAccount';

export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (
      !hasPermission(user, 'rentals.view') &&
      !hasPermission(user, 'rentals.create') &&
      !hasPermission(user, 'invoices.create')
    ) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const acc = await getDefaultRentalRevenueAccount(prisma, user.tenantId);
    return NextResponse.json({
      account: {
        id: acc.id,
        accountCode: acc.accountCode,
        accountName: acc.accountName,
      },
    });
  } catch (e) {
    if (e?.code === 'MISSING_4000') {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    }
    console.error('[default-revenue-account]', e);
    return NextResponse.json({ error: 'Failed to resolve account 4000' }, { status: 500 });
  }
}
