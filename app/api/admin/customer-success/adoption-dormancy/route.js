import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  listDormancyRiskQueue,
  openDormancyRecoveryCase,
  attestDormancyOutcome,
  linkPhase8Intervention,
  hasCustomerAdoptionDormancyCaseModel,
} from '@/lib/admin/customerSuccess/adoption';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId') || searchParams.get('adoptionPlanId');
    const tenantId = searchParams.get('tenantId');
    // Never forward client signal injects — Phase 9 read is server-side only
    const result = await listDormancyRiskQueue(prisma, {
      admin,
      actorContext: { admin },
      planId,
      tenantId,
    });
    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CS adoption dormancy queue error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list dormancy risk queue' },
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
    if (!hasCustomerAdoptionDormancyCaseModel(prisma)) {
      return NextResponse.json(
        {
          success: false,
          error: 'customer_adoption_dormancy_case_model_unavailable',
          status: 'UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'open').trim().toLowerCase();
    const ctx = { admin, actorContext: { admin } };

    let result;
    if (action === 'open') {
      result = await openDormancyRecoveryCase(prisma, {
        ...ctx,
        planId: body.planId || body.adoptionPlanId,
        signalIdentity: body.signalIdentity,
        signalCode: body.signalCode,
        featureCode: body.featureCode,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'link-intervention' || action === 'link') {
      result = await linkPhase8Intervention(prisma, {
        ...ctx,
        planId: body.planId || body.adoptionPlanId,
        dormancyCaseId: body.dormancyCaseId || body.caseId,
        interventionId: body.interventionId,
        playbookExecutionId: body.playbookExecutionId,
        outcomeAttestation: body.outcomeAttestation,
      });
    } else if (action === 'attest' || action === 'outcome') {
      // Never forward client usageReturnSnapshot — Phase 9 usage-return is
      // server-verified; outreach attestation + reason is the CS path.
      result = await attestDormancyOutcome(prisma, {
        ...ctx,
        planId: body.planId || body.adoptionPlanId,
        dormancyCaseId: body.dormancyCaseId || body.caseId,
        outcome: body.outcome || body.toStatus,
        outreachAttested: body.outreachAttested,
        attestedOutreach: body.attestedOutreach,
        outreachAttestation: body.outreachAttestation,
        reason: body.reason,
        featureCode: body.featureCode,
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
    console.error('CS adoption dormancy action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process dormancy action' },
      { status: 500 }
    );
  }
}
