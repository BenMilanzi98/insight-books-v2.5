import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import {
  listTaxReturns,
  createTaxReturnDraft,
  markTaxReturnReady,
  fileTaxReturn,
  createTaxReturnAmendment,
} from '@/lib/taxManagement/taxReturnService';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const returns = await listTaxReturns({
      tenantId: user.tenantId,
      taxPeriodId: searchParams.get('taxPeriodId') || null,
    });
    return NextResponse.json({ returns });
  } catch (error) {
    const status = error.code === 'RETURN_UNAVAILABLE' ? 503 : 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
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
    const action = body.action || 'create';

    if (action === 'create') {
      if (!body.taxPeriodId) {
        return NextResponse.json({ error: 'taxPeriodId is required' }, { status: 400 });
      }
      const taxReturn = await createTaxReturnDraft({
        tenantId: user.tenantId,
        userId: user.id,
        taxPeriodId: body.taxPeriodId,
        returnType: body.returnType || 'VAT',
        notes: body.notes || null,
      });
      return NextResponse.json({ success: true, return: taxReturn }, { status: 201 });
    }

    if (action === 'ready') {
      const taxReturn = await markTaxReturnReady({
        tenantId: user.tenantId,
        returnId: body.returnId,
      });
      return NextResponse.json({ success: true, return: taxReturn });
    }

    if (action === 'file') {
      const taxReturn = await fileTaxReturn({
        tenantId: user.tenantId,
        userId: user.id,
        returnId: body.returnId,
        reference: body.reference || null,
      });
      return NextResponse.json({ success: true, return: taxReturn });
    }

    if (action === 'amend') {
      const taxReturn = await createTaxReturnAmendment({
        tenantId: user.tenantId,
        userId: user.id,
        returnId: body.returnId,
        amendmentReason: body.amendmentReason,
      });
      return NextResponse.json({ success: true, return: taxReturn }, { status: 201 });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    const status =
      error.code === 'NOT_FOUND'
        ? 404
        : error.code === 'INVALID_STATUS' || error.code === 'INVALID_REASON'
          ? 400
          : error.code === 'RETURN_UNAVAILABLE'
            ? 503
            : 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
}
