import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  recordAdoptionValueOutcome,
  signOffAdoptionValueReview,
  listAdoptionValueOutcomes,
  evaluateAdoptionPlanCompletion,
  hasCustomerAdoptionValueOutcomeModel,
} from '@/lib/admin/customerSuccess/adoption';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasCustomerAdoptionValueOutcomeModel(prisma)) {
      return NextResponse.json(
        {
          success: false,
          error: 'customer_adoption_value_outcome_model_unavailable',
          status: 'UNAVAILABLE',
        },
        { status: 503 }
      );
    }
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId') || searchParams.get('adoptionPlanId');
    const result = await listAdoptionValueOutcomes(prisma, {
      admin,
      actorContext: { admin },
      planId,
    });
    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CS adoption value outcomes list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list value outcomes' },
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
    const action = String(body.action || 'record').trim().toLowerCase();
    const ctx = { admin, actorContext: { admin } };

    let result;
    if (action === 'record') {
      // Never forward client analyticsGate / measuredValue invent path —
      // Phase 9 is server-side; CS-attested requires explicit reason.
      const csAttested = body.csAttested === true || body.attested === true;
      result = await recordAdoptionValueOutcome(prisma, {
        ...ctx,
        planId: body.planId || body.adoptionPlanId,
        outcomeType: body.outcomeType,
        featureCode: body.featureCode,
        metricCode: body.metricCode,
        sourceSystem: body.sourceSystem,
        observedAt: body.observedAt,
        idempotencyKey: body.idempotencyKey,
        csAttested,
        reason: body.reason,
        // Measured value only accepted on CS-attested path (not invent READY).
        ...(csAttested && body.reason
          ? { measuredValue: body.measuredValue ?? body.value }
          : {}),
      });
    } else if (action === 'sign-off' || action === 'value-review') {
      result = await signOffAdoptionValueReview(prisma, {
        ...ctx,
        planId: body.planId || body.adoptionPlanId,
        reason: body.reason,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'evaluate-completion') {
      result = await evaluateAdoptionPlanCompletion(prisma, {
        ...ctx,
        planId: body.planId || body.adoptionPlanId,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'unknown_action' },
        { status: 400 }
      );
    }

    if (result?.forbidden) {
      return NextResponse.json(
        { success: false, error: result.reason || 'Forbidden' },
        { status: 403 }
      );
    }
    if (!result?.ok) {
      return NextResponse.json({ success: false, ...result }, { status: 400 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CS adoption value outcomes action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process value outcome action' },
      { status: 500 }
    );
  }
}
