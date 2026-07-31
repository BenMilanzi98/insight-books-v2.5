import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { createQuotation, listQuotations } from '@/lib/rentalV2/quotationService';

export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, ['rentals.view', 'invoices.view']);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const quotations = await listQuotations({
      tenantId: user.tenantId,
      status: searchParams.get('status') || undefined,
      clientId: searchParams.get('clientId') || undefined,
    });
    return NextResponse.json({ quotations });
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
    const quotation = await createQuotation({
      tenantId: user.tenantId,
      userId: user.id,
      ...body,
    });
    return NextResponse.json({ quotation }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 400 });
  }
}
