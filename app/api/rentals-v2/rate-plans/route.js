import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { createRatePlan, listRatePlans } from '@/lib/rentalV2/catalogueService';

export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, ['rentals.view']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const ratePlans = await listRatePlans({
      tenantId: user.tenantId,
      rentalAssetId: searchParams.get('rentalAssetId') || undefined,
    });
    return NextResponse.json({ ratePlans });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const perm = await requireAnyPermission(request, ['rentals.create', 'rentals.update']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    if (!body.rentalAssetId || !body.code || body.baseRate == null) {
      return NextResponse.json(
        { error: 'rentalAssetId, code, and baseRate are required' },
        { status: 400 }
      );
    }
    const ratePlan = await createRatePlan({ tenantId: user.tenantId, ...body });
    return NextResponse.json({ ratePlan }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 400 });
  }
}
