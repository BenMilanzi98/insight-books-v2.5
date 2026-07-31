import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  createTrainingCohort,
  verifyTrainingParticipant,
  enrolTrainingParticipant,
  assignTrainingTrainer,
  scheduleTrainingSession,
  recordTrainingSessionRsvp,
  captureTrainingAttendance,
  correctTrainingAttendance,
  assertRestrictedMaterialAccess,
  assertTrainingEnvironmentIsolation,
  requestVirtualTrainingProviderSession,
  evaluateTrainingConflicts,
  confirmTrainingSchedule,
  hasCustomerTrainingSessionModel,
} from '@/lib/admin/customerSuccess/training';

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasCustomerTrainingSessionModel(prisma)) {
      return NextResponse.json(
        {
          success: false,
          error: 'customer_training_session_model_unavailable',
          status: 'UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '').trim().toLowerCase();
    const actor = { admin, actorContext: { admin }, ...body };

    let result;
    switch (action) {
      case 'create-cohort':
        result = await createTrainingCohort(prisma, actor);
        break;
      case 'verify-participant':
        result = await verifyTrainingParticipant(prisma, actor);
        break;
      case 'enrol-participant':
        result = await enrolTrainingParticipant(prisma, actor);
        break;
      case 'assign-trainer':
        result = await assignTrainingTrainer(prisma, actor);
        break;
      case 'schedule-session':
        result = await scheduleTrainingSession(prisma, actor);
        break;
      case 'record-rsvp':
        result = await recordTrainingSessionRsvp(prisma, actor);
        break;
      case 'capture-attendance':
        result = await captureTrainingAttendance(prisma, actor);
        break;
      case 'correct-attendance':
        result = await correctTrainingAttendance(prisma, actor);
        break;
      case 'material-access':
        result = await assertRestrictedMaterialAccess(prisma, actor);
        break;
      case 'assert-environment':
        result = await assertTrainingEnvironmentIsolation(prisma, actor);
        break;
      case 'virtual-provider':
        result = await requestVirtualTrainingProviderSession(prisma, actor);
        break;
      case 'evaluate-conflicts':
        result = await evaluateTrainingConflicts(prisma, actor);
        break;
      case 'confirm-schedule':
        result = await confirmTrainingSchedule(prisma, actor);
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'unknown_action' },
          { status: 400 }
        );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || result.reason || 'action_failed' },
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
    console.error('CS training sessions action error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed training session action' },
      { status: 500 }
    );
  }
}
