import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  listAdoptionPlans,
  createCustomerAdoptionPlan,
  ensureWave1DefaultPlanTemplateVersion,
  hasCustomerAdoptionPlanModel,
} from '@/lib/admin/customerSuccess/adoption';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasCustomerAdoptionPlanModel(prisma)) {
      return NextResponse.json(
        {
          success: false,
          error: 'customer_adoption_plan_model_unavailable',
          status: 'UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    const result = await listAdoptionPlans(prisma, {
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
    console.error('CS adoption plans list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list adoption plans' },
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
    const action = String(body.action || 'create').trim().toLowerCase();

    let result;
    if (action === 'ensure-template' || action === 'seed-template') {
      result = await ensureWave1DefaultPlanTemplateVersion(prisma, {
        admin,
        actorContext: { admin },
      });
    } else if (action === 'create' || action === 'convert') {
      result = await createCustomerAdoptionPlan(prisma, {
        admin,
        actorContext: { admin },
        adoptionRequestId: body.adoptionRequestId || body.requestId,
        planTemplateVersionId: body.planTemplateVersionId || body.templateVersionId,
        ownerAssignments: body.ownerAssignments,
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
        { success: false, error: result.error || result.reason || 'plan_action_failed' },
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
    console.error('CS adoption plan action error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed adoption plan action' },
      { status: 500 }
    );
  }
}
