import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { closePosCashDayManual } from '@/lib/posCashDayService';

export async function POST(request) {
  try {
    const perm = await requireAnyPermission(request, ['sales.create', 'sales.update']);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const register = await closePosCashDayManual({
      tenantId: user.tenantId,
      userId: user.id,
      businessDate: body.businessDate || undefined,
    });
    return NextResponse.json({ success: true, register });
  } catch (e) {
    const status = e?.code === 'NOT_OPEN' || e?.code === 'CLOSE_USER_REQUIRED' ? 400 : 500;
    return NextResponse.json({ error: e?.message || 'Failed to close day', code: e?.code }, { status });
  }
}
