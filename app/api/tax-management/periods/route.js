import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import {
  listTaxPeriods,
  createTaxPeriod,
  rollForwardTaxPeriod,
} from '@/lib/taxManagement/taxPeriodService';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const periods = await listTaxPeriods({
      tenantId: user.tenantId,
      status: searchParams.get('status') || null,
    });
    return NextResponse.json({ periods });
  } catch (error) {
    const status = error.code === 'PERIOD_UNAVAILABLE' ? 503 : 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const perm = await requireAnyPermission(request, ['tax.update', 'taxManagement.update']);
    if (perm) return perm;

    const body = await request.json();
    if (body.action === 'roll-forward') {
      const period = await rollForwardTaxPeriod({ tenantId: user.tenantId });
      return NextResponse.json({ success: true, period }, { status: 201 });
    }

    const { code, label, periodType, startDate, endDate, notes } = body || {};
    if (!code || !label || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'code, label, startDate, and endDate are required' },
        { status: 400 }
      );
    }
    const period = await createTaxPeriod({
      tenantId: user.tenantId,
      code,
      label,
      periodType: periodType || 'MONTHLY',
      startDate,
      endDate,
      notes: notes || null,
    });
    return NextResponse.json({ success: true, period }, { status: 201 });
  } catch (error) {
    const status =
      error.code === 'PERIOD_UNAVAILABLE'
        ? 503
        : error.code === 'P2002'
          ? 409
          : 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
}
