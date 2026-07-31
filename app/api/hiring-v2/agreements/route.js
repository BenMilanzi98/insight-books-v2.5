import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { createHireAgreement, listHireAgreements } from '@/lib/hiringV2/hireService';

export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, ['rentals.view', 'purchases.view']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const agreements = await listHireAgreements({
      tenantId: user.tenantId,
      status: searchParams.get('status') || undefined,
    });
    return NextResponse.json({ agreements });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const perm = await requireAnyPermission(request, [
      'rentals.create',
      'rentals.update',
      'purchases.create',
    ]);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const agreement = await createHireAgreement({
      tenantId: user.tenantId,
      ...body,
    });
    return NextResponse.json({ agreement }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 400 });
  }
}
