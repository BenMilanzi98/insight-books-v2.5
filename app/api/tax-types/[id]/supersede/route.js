import { NextResponse } from 'next/server';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { supersedeTaxType } from '@/lib/taxManagement/taxCodeSupersession';

export async function POST(request, { params }) {
  try {
    const perm = await requirePermission(request, 'tax.update');
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    if (body.taxRate === undefined || body.taxRate === null || body.taxRate === '') {
      return NextResponse.json({ error: 'taxRate is required' }, { status: 400 });
    }

    const result = await supersedeTaxType({
      tenantId: user.tenantId,
      userId: user.id,
      taxTypeId: id,
      taxRate: body.taxRate,
      taxName: body.taxName || null,
      taxCode: body.taxCode || null,
      accountId: body.accountId || null,
      effectiveFrom: body.effectiveFrom || new Date(),
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    const status =
      error.code === 'NOT_FOUND'
        ? 404
        : error.code === 'ALREADY_SUPERSEDED' || error.code === 'INVALID_RATE'
          ? 400
          : 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
}
