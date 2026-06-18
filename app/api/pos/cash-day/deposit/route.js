import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { depositPosCashDay } from '@/lib/posCashDayService';

export async function POST(request) {
  try {
    const perm = await requireAnyPermission(request, ['sales.create', 'sales.update']);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const lines = Array.isArray(body.lines) ? body.lines : [];
    const register = await depositPosCashDay({
      tenantId: user.tenantId,
      userId: user.id,
      businessDate: body.businessDate || undefined,
      lines: lines.map((l) => ({
        toAccountId: l.toAccountId || l.paymentAccountId,
        amount: Number(l.amount),
        notes: l.notes || null,
      })),
    });
    return NextResponse.json({ success: true, register });
  } catch (e) {
    const status = e?.code === 'NOT_OPEN' ? 400 : 400;
    return NextResponse.json({ error: e?.message || 'Deposit failed', code: e?.code }, { status });
  }
}
