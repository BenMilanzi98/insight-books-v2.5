import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { accrueLeaveForMonth } from '@/lib/payrollV2/leaveAccrual';

export async function POST(request) {
  try {
    const perm = await requireAnyPermission(request, [
      'leave.create',
      'leave.view',
      'hr.view',
    ]);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const year = Number(body.year || now.getFullYear());
    const month = Number(body.month || now.getMonth() + 1);
    if (month < 1 || month > 12) {
      return NextResponse.json({ error: 'month must be 1–12' }, { status: 400 });
    }
    const results = await accrueLeaveForMonth({
      tenantId: user.tenantId,
      year,
      month,
      employeeId: body.employeeId || null,
    });
    return NextResponse.json({ results, year, month });
  } catch (e) {
    console.error('leave accrue', e);
    return NextResponse.json({ error: e.message || 'Accrual failed' }, { status: 500 });
  }
}
