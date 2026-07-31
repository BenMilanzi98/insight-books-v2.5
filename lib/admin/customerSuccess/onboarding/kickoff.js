/**
 * Onboarding kick-off ↔ Phase 13 CrmMeeting.
 * RSVP ≠ attendance; Meeting unavailable → MEETING_SERVICE_UNAVAILABLE.
 * Never fabricates kick-off complete from RSVP alone.
 */

import {
  CRM_MEETING_ATTENDANCE,
  CRM_MEETING_RSVP,
} from '../../crm/meetings/catalogue.js';
import { createMeeting, recordMeetingRsvp } from '../../crm/meetings/service.js';
import {
  getOnboardingDomainContract,
  MEETING_SERVICE_UNAVAILABLE,
} from './catalogue.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingKickoffModel,
  hasCustomerOnboardingProjectModel,
  resolveOnboardingActor,
  serializeOnboardingKickoff,
} from './model.js';

function resolveMeetingService(args = {}) {
  return (
    args.meetingService || {
      createMeeting,
      recordMeetingRsvp,
    }
  );
}

function mapMeetingUnavailable(result) {
  if (!result || result.ok) return null;
  const err = String(result.error || result.reason || result.status || '');
  if (
    /unavailable|model_unavailable|UNAVAILABLE/i.test(err) ||
    result.status === 'UNAVAILABLE'
  ) {
    return {
      ok: false,
      error: MEETING_SERVICE_UNAVAILABLE,
      status: 'UNAVAILABLE',
      underlying: result.error || result.reason || null,
      kickoffCompleted: false,
    };
  }
  return {
    ok: false,
    error: result.error || result.reason || 'meeting_create_failed',
    kickoffCompleted: false,
  };
}

/**
 * Schedule kick-off: create/link Phase 13 Meeting once (idempotent).
 */
export async function scheduleOnboardingKickoff(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_kickoff_forbidden' };
  }
  if (!hasCustomerOnboardingProjectModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_project_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  if (!hasCustomerOnboardingKickoffModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_kickoff_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const projectId = args.projectId ? String(args.projectId).trim() : '';
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  if (!projectId) return { ok: false, error: 'projectId_required' };
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };

  const existingByKey = await prisma.customerOnboardingKickoff.findUnique({
    where: { idempotencyKey },
  }).catch(async () =>
    prisma.customerOnboardingKickoff.findFirst({ where: { idempotencyKey } })
  );
  if (existingByKey) {
    if (String(existingByKey.projectId) !== projectId) {
      return {
        ok: false,
        error: 'idempotency_conflict',
        existingProjectId: existingByKey.projectId,
        attemptedProjectId: projectId,
      };
    }
    return {
      ok: true,
      kickoff: serializeOnboardingKickoff(existingByKey),
      crmMeetingId: existingByKey.crmMeetingId,
      alreadyExists: true,
      idempotentReplay: true,
      kickoffCompleted: false,
      domain: getOnboardingDomainContract(),
    };
  }

  const existingByProject = await prisma.customerOnboardingKickoff.findFirst({
    where: { projectId },
  });
  if (existingByProject) {
    return {
      ok: true,
      kickoff: serializeOnboardingKickoff(existingByProject),
      crmMeetingId: existingByProject.crmMeetingId,
      alreadyExists: true,
      idempotentReplay: true,
      kickoffCompleted: false,
      domain: getOnboardingDomainContract(),
    };
  }

  const project = await prisma.customerOnboardingProject.findUnique({
    where: { id: projectId },
  });
  if (!project) return { ok: false, error: 'project_not_found' };

  const meetingInput = args.meetingInput || {};
  const meetingService = resolveMeetingService(args);
  const now = args.now || new Date();

  const meetingResult = await meetingService.createMeeting(prisma, {
    admin,
    actorContext: args.actorContext,
    title: meetingInput.title || 'Onboarding kick-off',
    timezone: meetingInput.timezone,
    startsAt: meetingInput.startsAt,
    endsAt: meetingInput.endsAt,
    contactId: meetingInput.contactId || null,
    ownerAdminId: meetingInput.ownerAdminId || admin?.id || null,
    idempotencyKey: `meeting:${idempotencyKey}`,
    now,
  });

  if (!meetingResult?.ok) {
    return mapMeetingUnavailable(meetingResult);
  }

  const crmMeetingId = meetingResult.meeting?.id || meetingResult.crmMeetingId;
  if (!crmMeetingId) {
    return {
      ok: false,
      error: MEETING_SERVICE_UNAVAILABLE,
      status: 'UNAVAILABLE',
      kickoffCompleted: false,
    };
  }

  const kickoff = await prisma.customerOnboardingKickoff.create({
    data: {
      projectId,
      crmMeetingId,
      idempotencyKey,
      proposedAt: meetingInput.startsAt ? new Date(meetingInput.startsAt) : null,
      timezone: meetingInput.timezone || null,
      agendaJson: meetingInput.agendaJson || null,
      status: 'SCHEDULED',
      rsvpSummaryJson: { note: 'RSVP tracked on CrmMeetingParticipant; ≠ attendance' },
      attendanceSummaryJson: { note: 'Attendance requires separate confirmation' },
      kickoffCompleted: false,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    kickoff: serializeOnboardingKickoff(kickoff),
    crmMeetingId,
    created: true,
    kickoffCompleted: false,
    domain: getOnboardingDomainContract(),
  };
}

/**
 * Record RSVP for kick-off meeting participant. Does NOT set attendance or kickoffCompleted.
 */
export async function recordOnboardingKickoffRsvp(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_kickoff_rsvp_forbidden' };
  }

  const projectId = args.projectId ? String(args.projectId).trim() : '';
  const contactId = args.contactId ? String(args.contactId).trim() : '';
  const rsvpStatus = String(args.rsvpStatus || '')
    .trim()
    .toUpperCase();
  if (!projectId) return { ok: false, error: 'projectId_required' };
  if (!contactId) return { ok: false, error: 'contactId_required' };
  if (!rsvpStatus) return { ok: false, error: 'rsvpStatus_required' };

  const kickoff = await prisma.customerOnboardingKickoff.findFirst({
    where: { projectId },
  });
  if (!kickoff) return { ok: false, error: 'kickoff_not_found' };

  const meetingService = resolveMeetingService(args);
  if (typeof meetingService.recordMeetingRsvp === 'function') {
    const rsvpResult = await meetingService.recordMeetingRsvp(prisma, {
      admin,
      meetingId: kickoff.crmMeetingId,
      contactId,
      rsvpStatus,
    });
    if (!rsvpResult?.ok) {
      return mapMeetingUnavailable(rsvpResult) || {
        ok: false,
        error: rsvpResult?.error || 'rsvp_failed',
        kickoffCompleted: false,
      };
    }
  } else if (typeof prisma.crmMeetingParticipant?.findFirst === 'function') {
    const p = await prisma.crmMeetingParticipant.findFirst({
      where: { meetingId: kickoff.crmMeetingId, contactId },
    });
    if (p) {
      await prisma.crmMeetingParticipant.update({
        where: { id: p.id },
        data: { rsvpStatus },
      });
    }
  }

  return {
    ok: true,
    crmMeetingId: kickoff.crmMeetingId,
    rsvpStatus,
    attendanceStatus: CRM_MEETING_ATTENDANCE.UNKNOWN,
    kickoffCompleted: false,
    note: 'RSVP_ACCEPTED_IS_NOT_ATTENDANCE',
    domain: getOnboardingDomainContract(),
  };
}

export { CRM_MEETING_RSVP, CRM_MEETING_ATTENDANCE };
