import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  listOnboardingRequests,
  consumeOnboardingHandoff,
  validateOnboardingRequest,
  acceptOnboardingRequest,
  rejectOnboardingRequest,
  hasCustomerOnboardingRequestModel,
} from '@/lib/admin/customerSuccess/onboarding';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasCustomerOnboardingRequestModel(prisma)) {
      return NextResponse.json(
        {
          success: false,
          error: 'customer_onboarding_request_model_unavailable',
          status: 'UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    const result = await listOnboardingRequests(prisma, {
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
    console.error('CS onboarding requests list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list onboarding requests' },
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
      result = await consumeOnboardingHandoff(prisma, {
        admin,
        actorContext: { admin },
        handoffId: body.handoffId,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'validate') {
      result = await validateOnboardingRequest(prisma, {
        admin,
        actorContext: { admin },
        onboardingRequestId: body.onboardingRequestId || body.requestId,
      });
    } else if (action === 'accept') {
      result = await acceptOnboardingRequest(prisma, {
        admin,
        actorContext: { admin },
        onboardingRequestId: body.onboardingRequestId || body.requestId,
        reason: body.reason,
      });
    } else if (action === 'reject') {
      result = await rejectOnboardingRequest(prisma, {
        admin,
        actorContext: { admin },
        onboardingRequestId: body.onboardingRequestId || body.requestId,
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
    console.error('CS onboarding request action error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed onboarding request action' },
      { status: 500 }
    );
  }
}
