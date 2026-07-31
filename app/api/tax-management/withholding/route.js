import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import {
  listWithholdingRemittances,
  createWithholdingDraft,
  markWithholdingRemitted,
} from '@/lib/taxManagement/taxOpsRegisters';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const remittances = await listWithholdingRemittances({ tenantId: user.tenantId });
    return NextResponse.json({ remittances });
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
    if (body.action === 'remit') {
      const remittance = await markWithholdingRemitted({
        tenantId: user.tenantId,
        userId: user.id,
        remittanceId: body.remittanceId,
        remittanceDate: body.remittanceDate || new Date(),
        journalEntryId: body.journalEntryId || null,
      });
      return NextResponse.json({ success: true, remittance });
    }

    const remittance = await createWithholdingDraft({
      tenantId: user.tenantId,
      userId: user.id,
      amount: body.amount,
      taxPeriodId: body.taxPeriodId || null,
      counterparty: body.counterparty || null,
      reference: body.reference || null,
      notes: body.notes || null,
      paymentAccountId: body.paymentAccountId || null,
    });
    return NextResponse.json({ success: true, remittance }, { status: 201 });
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
