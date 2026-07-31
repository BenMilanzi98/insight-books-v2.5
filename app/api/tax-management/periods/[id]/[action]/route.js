import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { closeTaxPeriod, reopenTaxPeriod } from '@/lib/taxManagement/taxPeriodService';

export async function POST(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const perm = await requireAnyPermission(request, ['tax.update', 'taxManagement.update']);
    if (perm) return perm;

    const { id, action } = await params;
    let period;
    if (action === 'close') {
      period = await closeTaxPeriod({
        tenantId: user.tenantId,
        periodId: id,
        userId: user.id,
      });
    } else if (action === 'reopen') {
      period = await reopenTaxPeriod({
        tenantId: user.tenantId,
        periodId: id,
        userId: user.id,
      });
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
    return NextResponse.json({ success: true, period });
  } catch (error) {
    const status =
      error.code === 'NOT_FOUND'
        ? 404
        : error.code === 'INVALID_STATUS' || error.code === 'FILED_LOCKED'
          ? 400
          : error.code === 'PERIOD_UNAVAILABLE'
            ? 503
            : 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
}
