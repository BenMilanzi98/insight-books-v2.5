import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { transitionHireRequest } from '@/lib/hiringV2/hireService';

export async function POST(request, { params }) {
  try {
    const perm = await requireAnyPermission(request, [
      'rentals.update',
      'purchases.update',
      'purchases.approve',
    ]);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { id, action } = await params;
    const hireRequest = await transitionHireRequest({
      tenantId: user.tenantId,
      requestId: id,
      command: action,
    });
    return NextResponse.json({ request: hireRequest });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 400 });
  }
}
