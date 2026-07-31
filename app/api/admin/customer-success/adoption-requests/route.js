import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  listAdoptionRequests,
  consumeTrainingCompletionForAdoption,
  createManualAdoptionRequest,
  validateAdoptionRequest,
  acceptAdoptionRequest,
  rejectAdoptionRequest,
  attachOnboardingHandoverToAdoption,
  hasCustomerAdoptionRequestModel,
} from '@/lib/admin/customerSuccess/adoption';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasCustomerAdoptionRequestModel(prisma)) {
      return NextResponse.json(
        {
          success: false,
          error: 'customer_adoption_request_model_unavailable',
          status: 'UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    const result = await listAdoptionRequests(prisma, {
      admin,
      actorContext: { admin },
    });
    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CS adoption requests list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list adoption requests' },
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
    const action = String(body.action || 'consume').trim().toLowerCase();

    let result;
    if (action === 'consume' || action === 'consume-training') {
      result = await consumeTrainingCompletionForAdoption(prisma, {
        admin,
        actorContext: { admin },
        programId: body.programId || body.trainingProgramId,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'manual' || action === 'create') {
      result = await createManualAdoptionRequest(prisma, {
        admin,
        actorContext: { admin },
        customerId: body.customerId,
        tenantId: body.tenantId,
        subscriptionId: body.subscriptionId,
        idempotencyKey: body.idempotencyKey,
        payloadJson: body.payloadJson,
      });
    } else if (action === 'validate') {
      result = await validateAdoptionRequest(prisma, {
        admin,
        actorContext: { admin },
        adoptionRequestId: body.adoptionRequestId || body.requestId,
      });
    } else if (action === 'accept') {
      result = await acceptAdoptionRequest(prisma, {
        admin,
        actorContext: { admin },
        adoptionRequestId: body.adoptionRequestId || body.requestId,
        reason: body.reason,
      });
    } else if (action === 'reject') {
      result = await rejectAdoptionRequest(prisma, {
        admin,
        actorContext: { admin },
        adoptionRequestId: body.adoptionRequestId || body.requestId,
        reason: body.reason,
      });
    } else if (action === 'attach-handover' || action === 'attach') {
      result = await attachOnboardingHandoverToAdoption(prisma, {
        admin,
        actorContext: { admin },
        handoverId: body.handoverId,
        requestId: body.adoptionRequestId || body.requestId,
        planId: body.adoptionPlanId || body.planId,
        idempotencyKey: body.idempotencyKey,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'unknown_action' },
        { status: 400 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || result.reason || 'request_action_failed' },
        {
          status:
            result.status === 'UNAVAILABLE'
              ? 503
              : result.forbidden
                ? 403
                : result.notFound
                  ? 404
                  : 400,
        }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CS adoption request action error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed adoption request action' },
      { status: 500 }
    );
  }
}
