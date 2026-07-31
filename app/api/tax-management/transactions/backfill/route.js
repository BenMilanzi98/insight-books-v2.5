import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { backfillTaxTransactions } from '@/lib/taxManagement/taxSubledgerBackfill';

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const perm = await requireAnyPermission(request, [
      'tax.update',
      'taxManagement.update',
      'accounting.manage',
    ]);
    if (perm) return perm;

    const body = await request.json().catch(() => ({}));
    const result = await backfillTaxTransactions({
      tenantId: user.tenantId,
      startDate: body.startDate || null,
      endDate: body.endDate || null,
      limit: body.limit || 500,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('POST /api/tax-management/transactions/backfill:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
