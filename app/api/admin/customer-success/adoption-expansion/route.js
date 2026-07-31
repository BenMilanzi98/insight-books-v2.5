import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  createExpansionHandoff,
  acknowledgeExpansionHandoff,
  listExpansionHandoffs,
  hasCustomerAdoptionExpansionHandoffModel,
} from '@/lib/admin/customerSuccess/adoption';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasCustomerAdoptionExpansionHandoffModel(prisma)) {
      return NextResponse.json(
        {
          success: false,
          error: 'customer_adoption_expansion_handoff_model_unavailable',
          status: 'UNAVAILABLE',
        },
        { status: 503 }
      );
    }
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId') || searchParams.get('adoptionPlanId');
    const result = await listExpansionHandoffs(prisma, {
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
    console.error('CS adoption expansion list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list expansion handoffs' },
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
    if (!hasCustomerAdoptionExpansionHandoffModel(prisma)) {
      return NextResponse.json(
        {
          success: false,
          error: 'customer_adoption_expansion_handoff_model_unavailable',
          status: 'UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'create').trim().toLowerCase();
    const ctx = { admin, actorContext: { admin } };

    let result;
    if (action === 'create') {
      result = await createExpansionHandoff(prisma, {
        ...ctx,
        planId: body.planId || body.adoptionPlanId,
        targetQueue: body.targetQueue,
        signalPackage: body.signalPackage,
        evidenceRefs: body.evidenceRefs,
        status: body.status,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'hand_off' || action === 'hand-off') {
      result = await acknowledgeExpansionHandoff(prisma, {
        ...ctx,
        planId: body.planId || body.adoptionPlanId,
        handoffId: body.handoffId || body.id,
        action: 'hand_off',
      });
    } else if (action === 'acknowledge' || action === 'ack') {
      // SoD default-enforced server-side — never accept client disable.
      result = await acknowledgeExpansionHandoff(prisma, {
        ...ctx,
        planId: body.planId || body.adoptionPlanId,
        handoffId: body.handoffId || body.id,
      });
    } else if (action === 'reject') {
      result = await acknowledgeExpansionHandoff(prisma, {
        ...ctx,
        planId: body.planId || body.adoptionPlanId,
        handoffId: body.handoffId || body.id,
        action: 'reject',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'unknown_action' },
        { status: 400 }
      );
    }

    if (result?.forbidden) {
      return NextResponse.json(
        { success: false, error: result.reason || result.error || 'Forbidden' },
        { status: 403 }
      );
    }
    if (!result?.ok) {
      return NextResponse.json({ success: false, ...result }, { status: 400 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CS adoption expansion action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process expansion handoff action' },
      { status: 500 }
    );
  }
}
