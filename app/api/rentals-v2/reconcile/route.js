import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import {
  reconcileContractDetail,
  reconcileHireDetail,
  reconcileRentalHiringTenant,
} from '@/lib/rentalV2/reconcileService';

export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, [
      'rentals.view',
      'invoices.view',
      'accounting.view',
      'purchases.view',
    ]);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const agreementId = searchParams.get('agreementId');
    if (contractId) {
      const detail = await reconcileContractDetail({
        tenantId: user.tenantId,
        contractId,
      });
      return NextResponse.json({ detail });
    }
    if (agreementId) {
      const detail = await reconcileHireDetail({
        tenantId: user.tenantId,
        agreementId,
      });
      return NextResponse.json({ detail });
    }
    const report = await reconcileRentalHiringTenant({ tenantId: user.tenantId });
    return NextResponse.json(report);
  } catch (e) {
    console.error('rentals-v2 reconcile', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
