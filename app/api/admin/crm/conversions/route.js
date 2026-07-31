import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  dryRunConversion,
  executeClosedWonConversion,
  resumeConversion,
  createConversionPlan,
  evaluateConversionReadiness,
  hasCrmConversionModel,
} from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversionRequestId = searchParams.get('conversionRequestId');
    if (conversionRequestId) {
      const readiness = await evaluateConversionReadiness(prisma, {
        admin,
        actorContext: { admin },
        conversionRequestId,
      });
      return NextResponse.json({ success: readiness.ok !== false, ...readiness });
    }

    if (!hasCrmConversionModel(prisma)) {
      return NextResponse.json(
        { success: false, error: 'crm_conversion_model_unavailable', status: 'UNAVAILABLE' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      conversions: [],
      hint: 'Wave 1 thin list — filter by conversionRequestId for readiness',
    });
  } catch (error) {
    console.error('CRM conversions list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list CRM conversions' },
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
    const action = String(body.action || 'execute').trim().toLowerCase();

    if (action === 'plan') {
      const result = await createConversionPlan(prisma, {
        admin,
        actorContext: { admin },
        conversionRequestId: body.conversionRequestId,
        forceNewVersion: body.forceNewVersion === true,
        notes: body.notes,
      });
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.error || 'plan_failed' },
          { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
        );
      }
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'dry-run' || action === 'dryrun') {
      const result = await dryRunConversion(prisma, {
        admin,
        actorContext: { admin },
        conversionRequestId: body.conversionRequestId,
        conversionPlanVersionId: body.conversionPlanVersionId,
      });
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.error || 'dry_run_failed' },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'resume') {
      const result = await resumeConversion(prisma, {
        admin,
        actorContext: { admin },
        conversionId: body.conversionId,
        idempotencyKey: body.idempotencyKey,
      });
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.error || 'resume_failed' },
          { status: result.forbidden ? 403 : 400 }
        );
      }
      return NextResponse.json({ success: true, ...result });
    }

    const result = await executeClosedWonConversion(prisma, {
      admin,
      actorContext: { admin },
      conversionRequestId: body.conversionRequestId,
      conversionPlanVersionId: body.conversionPlanVersionId,
      idempotencyKey: body.idempotencyKey,
      winReason: body.winReason,
      decisionDate: body.decisionDate,
      evidence: body.evidence,
      simulateLaterStepFailure: body.simulateLaterStepFailure === true,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'execute_failed' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result }, { status: result.alreadyExists ? 200 : 201 });
  } catch (error) {
    console.error('CRM conversions action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed CRM conversion action' },
      { status: 500 }
    );
  }
}
