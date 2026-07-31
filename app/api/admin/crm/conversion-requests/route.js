import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  createConversionRequest,
  createConversionRequestFromClosedWonHandoff,
  listConversionRequests,
} from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const result = await listConversionRequests(prisma, {
      admin,
      actorContext: { admin },
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to list conversion requests' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM conversion-requests list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list CRM conversion requests' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const fromHandoff = body.fromHandoff === true || body.source === 'PHASE_15_ACCEPTANCE_HANDOFF';

    const result = fromHandoff
      ? await createConversionRequestFromClosedWonHandoff(prisma, {
          admin,
          actorContext: { admin },
          acceptanceId: body.acceptanceId,
          handoffId: body.handoffId,
          idempotencyKey: body.idempotencyKey,
          opportunityId: body.opportunityId,
        })
      : await createConversionRequest(prisma, {
          admin,
          actorContext: { admin },
          source: body.source,
          conversionType: body.conversionType,
          acceptanceId: body.acceptanceId,
          handoffId: body.handoffId,
          opportunityId: body.opportunityId,
          accountId: body.accountId,
          contactId: body.contactId,
          documentVersionId: body.documentVersionId,
          checksumSha256: body.checksumSha256,
          currency: body.currency,
          payloadJson: body.payloadJson,
          idempotencyKey: body.idempotencyKey,
        });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create conversion request' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result }, { status: result.alreadyExists ? 200 : 201 });
  } catch (error) {
    console.error('CRM conversion-requests create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create CRM conversion request' },
      { status: 500 }
    );
  }
}
