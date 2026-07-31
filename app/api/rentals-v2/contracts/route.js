import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { createContract, listContracts } from '@/lib/rentalV2/contractService';

export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, ['rentals.view', 'invoices.view']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const contracts = await listContracts({
      tenantId: user.tenantId,
      status: searchParams.get('status') || undefined,
      clientId: searchParams.get('clientId') || undefined,
    });
    return NextResponse.json({ contracts });
  } catch (e) {
    console.error('rentals-v2 list contracts', e);
    return NextResponse.json({ error: e.message || 'Failed to list contracts' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const perm = await requireAnyPermission(request, [
      'rentals.create',
      'rentals.update',
      'invoices.create',
    ]);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const contract = await createContract({
      tenantId: user.tenantId,
      userId: user.id,
      ...body,
    });
    return NextResponse.json({ contract }, { status: 201 });
  } catch (e) {
    console.error('rentals-v2 create contract', e);
    const status = e.code === 'DOUBLE_BOOK' || e.code === 'OVERBOOK_QTY' ? 409 : 400;
    return NextResponse.json({ error: e.message || 'Failed to create contract' }, { status });
  }
}
