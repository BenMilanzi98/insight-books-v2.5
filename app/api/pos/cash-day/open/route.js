import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { openPosCashDay } from '@/lib/posCashDayService';

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const register = await openPosCashDay({
      tenantId: user.tenantId,
      userId: user.id,
      businessDate: body.businessDate || undefined,
    });
    return NextResponse.json({ success: true, register });
  } catch (e) {
    const code = e?.code;
    const status = code === 'ALREADY_OPEN' ? 409 : code === 'ALREADY_CLOSED' ? 409 : 400;
    return NextResponse.json({ error: e?.message || 'Failed to open day', code }, { status });
  }
}
