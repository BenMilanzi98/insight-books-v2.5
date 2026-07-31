import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  materialiseAdoptionMilestones,
  evaluateAdoptionMilestone,
  attestAdoptionMilestone,
  waiveAdoptionMilestone,
  listAdoptionMilestones,
  hasCustomerAdoptionMilestoneModel,
} from '@/lib/admin/customerSuccess/adoption';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasCustomerAdoptionMilestoneModel(prisma)) {
      return NextResponse.json(
        {
          success: false,
          error: 'customer_adoption_milestone_model_unavailable',
          status: 'UNAVAILABLE',
        },
        { status: 503 }
      );
    }
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId') || searchParams.get('adoptionPlanId');
    const result = await listAdoptionMilestones(prisma, {
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
    console.error('CS adoption milestones list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list adoption milestones' },
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
    const action = String(body.action || 'materialise').trim().toLowerCase();
    const ctx = { admin, actorContext: { admin } };

    let result;
    if (action === 'materialise') {
      result = await materialiseAdoptionMilestones(prisma, {
        ...ctx,
        planId: body.planId || body.adoptionPlanId,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'evaluate') {
      // Never forward client analyticsGate / phase9Snapshot — Phase 9 MET
      // evidence is resolved server-side only (test injects stay off HTTP).
      result = await evaluateAdoptionMilestone(prisma, {
        ...ctx,
        planId: body.planId || body.adoptionPlanId,
        milestoneId: body.milestoneId,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'attest') {
      result = await attestAdoptionMilestone(prisma, {
        ...ctx,
        planId: body.planId || body.adoptionPlanId,
        milestoneId: body.milestoneId,
        reason: body.reason,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'waive') {
      result = await waiveAdoptionMilestone(prisma, {
        ...ctx,
        planId: body.planId || body.adoptionPlanId,
        milestoneId: body.milestoneId,
        reason: body.reason,
        idempotencyKey: body.idempotencyKey,
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
    console.error('CS adoption milestones action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process adoption milestone action' },
      { status: 500 }
    );
  }
}
