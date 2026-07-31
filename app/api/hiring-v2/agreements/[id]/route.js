import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { getHireAgreement, reconcileHireAgreement } from '@/lib/hiringV2/hireService';

export async function GET(request, { params }) {
  try {
    const perm = await requireAnyPermission(request, ['rentals.view', 'purchases.view']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { id } = await params;
    const agreement = await getHireAgreement({ tenantId: user.tenantId, agreementId: id });
    const reconcile = await reconcileHireAgreement({
      tenantId: user.tenantId,
      agreementId: id,
    });
    return NextResponse.json({ agreement, reconcile });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Not found' }, { status: 404 });
  }
}
