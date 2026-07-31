import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  addDemoParticipant,
  approveDemoRecording,
  configureDemoReadinessRequirements,
  createDemoFollowUp,
  denyDemoRecording,
  emitDemoProposalHandoff,
  emitDemoTrialHandoff,
  endDemoDelivery,
  evaluateDemoReadiness,
  executeDemoChecklist,
  pinAgendaToDemo,
  pinChecklistToDemo,
  pinContentToDemo,
  pinScenarioToDemo,
  pinScriptToDemo,
  projectAttendanceFromMeeting,
  recordAgendaCoverage,
  recordCustomerQuestion,
  recordDemoAttendance,
  recordDemoFeedbackResponse,
  recordDemoOutcome,
  recordDemoRehearsal,
  recordLiveIssue,
  removeDemoParticipant,
  requestDemoRecording,
  scheduleDemo,
  setDemoRecordingConsent,
  startDemoDelivery,
  transitionDemoStatus,
} from '@/lib/admin/crm';

const ACTIONS = new Set([
  'schedule',
  'status',
  'readiness',
  'participants',
  'remove-participant',
  'pin-agenda',
  'pin-script',
  'pin-scenario',
  'pin-content',
  'pin-checklist',
  'configure-readiness',
  'execute-checklist',
  'record-rehearsal',
  'start-delivery',
  'end-delivery',
  'agenda-coverage',
  'live-issue',
  'customer-question',
  'attendance',
  'project-attendance',
  'request-recording',
  'recording-consent',
  'approve-recording',
  'deny-recording',
  'feedback',
  'outcome',
  'follow-up',
  'proposal-handoff',
  'trial-handoff',
]);

export async function POST(request, context) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const id = params?.id;
    const action = String(params?.action || '')
      .trim()
      .toLowerCase();
    if (!ACTIONS.has(action)) {
      return NextResponse.json(
        { success: false, error: 'Unsupported action' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    let result;

    if (action === 'schedule') {
      result = await scheduleDemo(prisma, {
        admin,
        demoId: id,
        title: body.title,
        timezone: body.timezone,
        startsAt: body.startsAt || body.startsAtUtc,
        endsAt: body.endsAt || body.endsAtUtc,
        startsAtOriginal: body.startsAtOriginal,
        endsAtOriginal: body.endsAtOriginal,
        location: body.location,
        notes: body.notes,
        contactId: body.contactId,
        purpose: body.purpose,
        visibility: body.visibility,
        participants: body.participants,
        sendInvitations: body.sendInvitations === true,
        conflictPolicy: body.conflictPolicy,
        conflictReason: body.conflictReason,
        ownerAdminId: body.ownerAdminId,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'status') {
      result = await transitionDemoStatus(prisma, {
        admin,
        demoId: id,
        toStatus: body.toStatus || body.status,
        reason: body.reason,
      });
    } else if (action === 'readiness') {
      result = await evaluateDemoReadiness(prisma, {
        admin,
        demoId: id,
        persist: body.persist !== false,
      });
    } else if (action === 'participants') {
      result = await addDemoParticipant(prisma, {
        admin,
        demoId: id,
        participantType: body.participantType,
        participantId: body.participantId,
        role: body.role,
        evaluateEligibility: body.evaluateEligibility === true,
      });
    } else if (action === 'pin-agenda') {
      result = await pinAgendaToDemo(prisma, {
        admin,
        demoId: id,
        agendaId: body.agendaId || body.id,
      });
    } else if (action === 'pin-script') {
      result = await pinScriptToDemo(prisma, {
        admin,
        demoId: id,
        scriptId: body.scriptId || body.id,
      });
    } else if (action === 'pin-scenario') {
      result = await pinScenarioToDemo(prisma, {
        admin,
        demoId: id,
        scenarioId: body.scenarioId || body.id,
      });
    } else if (action === 'pin-content') {
      result = await pinContentToDemo(prisma, {
        admin,
        demoId: id,
        contentId: body.contentId || body.id,
      });
    } else if (action === 'pin-checklist') {
      result = await pinChecklistToDemo(prisma, {
        admin,
        demoId: id,
        checklistId: body.checklistId || body.id,
      });
    } else if (action === 'configure-readiness') {
      result = await configureDemoReadinessRequirements(prisma, {
        admin,
        demoId: id,
        requiresLogicalEnvironment: body.requiresLogicalEnvironment,
        requiresChecklist: body.requiresChecklist,
        requiresRehearsal: body.requiresRehearsal,
      });
    } else if (action === 'execute-checklist') {
      result = await executeDemoChecklist(prisma, {
        admin,
        demoId: id,
        checklistId: body.checklistId,
        results: body.results,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'record-rehearsal') {
      result = await recordDemoRehearsal(prisma, {
        admin,
        demoId: id,
        outcome: body.outcome,
        issues: body.issues,
        notes: body.notes,
        checklistExecutionId: body.checklistExecutionId,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'start-delivery') {
      result = await startDemoDelivery(prisma, {
        admin,
        demoId: id,
        agendaCoverageJson: body.agendaCoverageJson || body.coverage,
        notes: body.notes,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'end-delivery') {
      result = await endDemoDelivery(prisma, {
        admin,
        demoId: id,
        sessionId: body.sessionId,
        agendaCoverageJson: body.agendaCoverageJson || body.coverage,
        notes: body.notes,
      });
    } else if (action === 'agenda-coverage') {
      result = await recordAgendaCoverage(prisma, {
        admin,
        demoId: id,
        sessionId: body.sessionId,
        coverage: body.coverage || body.agendaCoverageJson,
      });
    } else if (action === 'live-issue') {
      result = await recordLiveIssue(prisma, {
        admin,
        demoId: id,
        deliverySessionId: body.deliverySessionId || body.sessionId,
        severity: body.severity,
        summary: body.summary,
        detail: body.detail,
      });
    } else if (action === 'customer-question') {
      result = await recordCustomerQuestion(prisma, {
        admin,
        demoId: id,
        deliverySessionId: body.deliverySessionId || body.sessionId,
        question: body.question,
        answer: body.answer,
        askedBy: body.askedBy,
      });
    } else if (action === 'attendance') {
      result = await recordDemoAttendance(prisma, {
        admin,
        demoId: id,
        participantRecordId: body.participantRecordId,
        participantType: body.participantType,
        participantId: body.participantId,
        attendanceStatus: body.attendanceStatus,
        source: body.source,
        meetingParticipantId: body.meetingParticipantId,
        notes: body.notes,
        fromRsvp: body.fromRsvp === true,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'project-attendance') {
      result = await projectAttendanceFromMeeting(prisma, {
        admin,
        demoId: id,
      });
    } else if (action === 'request-recording') {
      result = await requestDemoRecording(prisma, {
        admin,
        demoId: id,
        contactId: body.contactId,
        notes: body.notes,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'recording-consent') {
      result = await setDemoRecordingConsent(prisma, {
        admin,
        demoId: id,
        contactId: body.contactId,
        consentStatus: body.consentStatus || body.status,
        source: body.source,
        fromRsvp: body.fromRsvp === true,
      });
    } else if (action === 'approve-recording') {
      result = await approveDemoRecording(prisma, {
        admin,
        demoId: id,
        notes: body.notes,
      });
    } else if (action === 'deny-recording') {
      result = await denyDemoRecording(prisma, {
        admin,
        demoId: id,
        notes: body.notes,
      });
    } else if (action === 'feedback') {
      result = await recordDemoFeedbackResponse(prisma, {
        admin,
        demoId: id,
        formId: body.formId,
        score: body.score,
        responses: body.responses || body.responsesJson,
        submittedBy: body.submittedBy,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'outcome') {
      result = await recordDemoOutcome(prisma, {
        admin,
        demoId: id,
        outcomeCode: body.outcomeCode || body.outcome,
        completeness: body.completeness,
        success: body.success,
        notes: body.notes,
        mutateOpportunity: body.mutateOpportunity,
        updateStage: body.updateStage,
        updateProbability: body.updateProbability,
        updateCloseDate: body.updateCloseDate,
        opportunityStage: body.opportunityStage,
        winProbability: body.winProbability,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'follow-up') {
      result = await createDemoFollowUp(prisma, {
        admin,
        demoId: id,
        title: body.title,
        dueAt: body.dueAt,
        channel: body.channel,
        contactId: body.contactId,
        purpose: body.purpose,
        ownerAdminId: body.ownerAdminId,
        subjectType: body.subjectType,
        subjectId: body.subjectId,
        linkToLead: body.linkToLead === true,
        linkToOpportunity: body.linkToOpportunity === true,
      });
    } else if (action === 'proposal-handoff') {
      result = await emitDemoProposalHandoff(prisma, {
        admin,
        demoId: id,
        createProposal: body.createProposal === true,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'trial-handoff') {
      result = await emitDemoTrialHandoff(prisma, {
        admin,
        demoId: id,
        createTrial: body.createTrial === true,
        createTenant: body.createTenant === true,
        provisionTenant: body.provisionTenant === true,
        idempotencyKey: body.idempotencyKey,
      });
    } else {
      result = await removeDemoParticipant(prisma, {
        admin,
        participantRecordId: body.participantRecordId || body.id,
      });
    }

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: result.error || 'Not found' },
        { status: 404 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || `Failed to ${action} demo`,
          blockers: result.blockers,
          readinessStatus: result.readinessStatus,
          conflicts: result.conflicts,
        },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('CRM demo action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process demo action' },
      { status: 500 }
    );
  }
}
