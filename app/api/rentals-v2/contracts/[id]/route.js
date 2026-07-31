import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { getContract, updateContractMappings } from '@/lib/rentalV2/contractService';
import { reconcileContractBilling } from '@/lib/rentalV2/billingService';

export async function GET(request, { params }) {
  try {
    const perm = await requireAnyPermission(request, ['rentals.view', 'invoices.view']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { id } = await params;
    const contract = await getContract({ tenantId: user.tenantId, contractId: id });
    const reconcile = await reconcileContractBilling({
      tenantId: user.tenantId,
      contractId: id,
    });
    return NextResponse.json({ contract, reconcile });
  } catch (e) {
    console.error('rentals-v2 get contract', e);
    return NextResponse.json({ error: e.message || 'Failed to load contract' }, { status: 404 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const perm = await requireAnyPermission(request, ['rentals.update', 'invoices.update']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (body.mappingSnapshot) {
      const contract = await updateContractMappings({
        tenantId: user.tenantId,
        contractId: id,
        mappingSnapshot: body.mappingSnapshot,
      });
      return NextResponse.json({ contract });
    }
    return NextResponse.json({ error: 'No supported patch fields' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Patch failed' }, { status: 400 });
  }
}
