import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { approveDiscountRequest, createDiscountRequest } from '@/lib/admin/crm';

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'create').trim().toLowerCase();

    let result;
    if (action === 'approve') {
      result = await approveDiscountRequest(prisma, {
        admin,
        actorContext: { admin },
        discountRequestId: body.discountRequestId,
      });
    } else {
      result = await createDiscountRequest(prisma, {
        admin,
        actorContext: { admin },
        commercialDocumentVersionId: body.commercialDocumentVersionId || body.documentVersionId,
        percent: body.percent,
        reason: body.reason,
      });
    }

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Discount request failed', reason: result.reason },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result }, { status: result.alreadyExists ? 200 : 201 });
  } catch (error) {
    console.error('CRM discount requests error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed CRM discount request action' },
      { status: 500 }
    );
  }
}
