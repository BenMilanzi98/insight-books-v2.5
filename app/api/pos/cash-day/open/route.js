import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { openPosCashDay } from '@/lib/posCashDayService';

export async function POST(request) {
  try {
    const perm = await requireAnyPermission(request, ['sales.create', 'sales.update']);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const register = await openPosCashDay({
      tenantId: user.tenantId,
      userId: user.id,
      businessDate: body.businessDate || undefined,
      openingBalance:
        body.openingBalance !== undefined && body.openingBalance !== null && body.openingBalance !== ''
          ? body.openingBalance
          : undefined,
    });
    return NextResponse.json({ success: true, register });
  } catch (e) {
    console.error('pos/cash-day/open failed', e?.code || e?.name, e?.message || e, e?.issues || e?.diagnostic);
    const code = e?.code;
    const status =
      code === 'ALREADY_OPEN' ||
      code === 'CAPITAL_UNMAPPED' ||
      code === 'TILL_FLOAT_UNMAPPED' ||
      code === 'CASH_COA_UNMAPPED'
        ? 409
        : code === 'MIGRATION_REQUIRED'
          ? 503
          : code === 'INVALID_OPENING_BALANCE'
            ? 400
            : 400;
    const detail =
      Array.isArray(e?.issues) && e.issues.length
        ? e.issues.map((i) => i.message || i.path).filter(Boolean).join('; ')
        : null;
    return NextResponse.json(
      {
        error: detail ? `${e?.message || 'Failed to open day'} (${detail})` : e?.message || 'Failed to open day',
        code,
        issues: e?.issues || undefined,
      },
      { status }
    );
  }
}
