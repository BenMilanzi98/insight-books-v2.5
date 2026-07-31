import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  listTrainingPrograms,
  createCustomerTrainingProgram,
  ensureWave1OnboardingCurriculumVersion,
  hasCustomerTrainingProgramModel,
} from '@/lib/admin/customerSuccess/training';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasCustomerTrainingProgramModel(prisma)) {
      return NextResponse.json(
        {
          success: false,
          error: 'customer_training_program_model_unavailable',
          status: 'UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    const result = await listTrainingPrograms(prisma, {
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
    console.error('CS training programs list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list training programs' },
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
    if (action === 'ensure-curriculum' || action === 'seed-curriculum') {
      result = await ensureWave1OnboardingCurriculumVersion(prisma, {
        admin,
        actorContext: { admin },
      });
    } else if (action === 'create' || action === 'convert') {
      result = await createCustomerTrainingProgram(prisma, {
        admin,
        actorContext: { admin },
        trainingRequestId: body.trainingRequestId || body.requestId,
        curriculumVersionId: body.curriculumVersionId,
        ownerAssignments: body.ownerAssignments,
        targetStartDate: body.targetStartDate,
        targetCompletionDate: body.targetCompletionDate,
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
        { success: false, error: result.error || result.reason || 'program_action_failed' },
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
    console.error('CS training program action error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed training program action' },
      { status: 500 }
    );
  }
}
