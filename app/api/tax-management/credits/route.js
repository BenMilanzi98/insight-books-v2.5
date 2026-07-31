import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import {
  listTaxCredits,
  createTaxCredit,
  applyTaxCredit,
  voidTaxCredit,
} from '@/lib/taxManagement/taxOpsRegisters';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const credits = await listTaxCredits({ tenantId: user.tenantId });
    return NextResponse.json({ credits });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const perm = await requireAnyPermission(request, ['tax.update', 'taxManagement.update']);
    if (perm) return perm;

    const body = await request.json();
    if (body.action === 'apply') {
      const credit = await applyTaxCredit({
        tenantId: user.tenantId,
        creditId: body.creditId,
        amount: body.amount,
        appliedToPaymentId: body.appliedToPaymentId || null,
      });
      return NextResponse.json({ success: true, credit });
    }
    if (body.action === 'void') {
      const credit = await voidTaxCredit({
        tenantId: user.tenantId,
        creditId: body.creditId,
      });
      return NextResponse.json({ success: true, credit });
    }

    const credit = await createTaxCredit({
      tenantId: user.tenantId,
      userId: user.id,
      amount: body.amount,
      taxPeriodId: body.taxPeriodId || null,
      taxTypeId: body.taxTypeId || null,
      source: body.source || null,
      reference: body.reference || null,
      notes: body.notes || null,
    });
    return NextResponse.json({ success: true, credit }, { status: 201 });
  } catch (error) {
    const status =
      error.code === 'INVALID_AMOUNT' || error.code === 'INVALID_STATUS'
        ? 400
        : error.code === 'NOT_FOUND'
          ? 404
          : error.code === 'OPS_UNAVAILABLE'
            ? 503
            : 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
}
