import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  listTrainingRequests,
  consumeTrainingHandoff,
  validateTrainingRequest,
  acceptTrainingRequest,
  rejectTrainingRequest,
  hasCustomerTrainingRequestModel,
} from '@/lib/admin/customerSuccess/training';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasCustomerTrainingRequestModel(prisma)) {
      return NextResponse.json(
        {
          success: false,
          error: 'customer_training_request_model_unavailable',
          status: 'UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    const result = await listTrainingRequests(prisma, {
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
    console.error('CS training requests list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list training requests' },
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
    if (action === 'consume' || action === 'consume-handoff') {
      result = await consumeTrainingHandoff(prisma, {
        admin,
        actorContext: { admin },
        handoffId: body.handoffId,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'validate') {
      result = await validateTrainingRequest(prisma, {
        admin,
        actorContext: { admin },
        trainingRequestId: body.trainingRequestId || body.requestId,
      });
    } else if (action === 'accept') {
      result = await acceptTrainingRequest(prisma, {
        admin,
        actorContext: { admin },
        trainingRequestId: body.trainingRequestId || body.requestId,
        reason: body.reason,
      });
    } else if (action === 'reject') {
      result = await rejectTrainingRequest(prisma, {
        admin,
        actorContext: { admin },
        trainingRequestId: body.trainingRequestId || body.requestId,
        reason: body.reason,
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
    console.error('CS training request action error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed training request action' },
      { status: 500 }
    );
  }
}
