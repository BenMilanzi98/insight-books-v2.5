import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { createPayrollRun, listPayrollRuns } from '@/lib/payrollV2/runService';

export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, ['payroll.view', 'hr.view']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const runs = await listPayrollRuns({ tenantId: user.tenantId });
    return NextResponse.json({ runs });
  } catch (e) {
    console.error('payroll-v2 list runs', e);
    return NextResponse.json({ error: e.message || 'Failed to list runs' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const perm = await requireAnyPermission(request, [
      'payroll.create',
      'payroll.update',
      'payroll.view',
      'hr.view',
    ]);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    if (!body.periodStart || !body.periodEnd) {
      return NextResponse.json(
        { error: 'periodStart and periodEnd are required' },
        { status: 400 }
      );
    }
    const run = await createPayrollRun({
      tenantId: user.tenantId,
      userId: user.id,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      notes: body.notes,
    });
    return NextResponse.json({ run }, { status: 201 });
  } catch (e) {
    console.error('payroll-v2 create run', e);
    return NextResponse.json({ error: e.message || 'Failed to create run' }, { status: 500 });
  }
}
