import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import {
  listTaxRefunds,
  createTaxRefundDraft,
  markTaxRefundPosted,
} from '@/lib/taxManagement/taxOpsRegisters';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const refunds = await listTaxRefunds({ tenantId: user.tenantId });
    return NextResponse.json({ refunds });
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
    const perm = await requireAnyPermission(request, [
      'tax.update',
      'tax.settle',
      'taxManagement.update',
    ]);
    if (perm) return perm;

    const body = await request.json();
    if (body.action === 'post') {
      const refund = await markTaxRefundPosted({
        tenantId: user.tenantId,
        userId: user.id,
        refundId: body.refundId,
        refundDate: body.refundDate || new Date(),
        journalEntryId: body.journalEntryId || null,
      });
      return NextResponse.json({ success: true, refund });
    }

    const refund = await createTaxRefundDraft({
      tenantId: user.tenantId,
      userId: user.id,
      amount: body.amount,
      taxPeriodId: body.taxPeriodId || null,
      taxTypeId: body.taxTypeId || null,
      reason: body.reason || null,
      notes: body.notes || null,
      paymentAccountId: body.paymentAccountId || null,
    });
    return NextResponse.json({ success: true, refund }, { status: 201 });
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
