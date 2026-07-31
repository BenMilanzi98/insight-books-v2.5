/**
 * Demo participants — Phase 14 Wave 1.
 * Roles: PRIMARY_CONTACT, PRESENTER, ORGANIZER, REQUIRED, OPTIONAL.
 * RSVP ≠ attendance; attendance stays UNKNOWN until Wave 4.
 */

import {
  CRM_COMMUNICATION_CHANNEL,
  CRM_CONSENT_PURPOSE,
  CRM_SUBJECT_TYPE,
  CRM_TIMELINE_EVENT_TYPE,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { checkCommunicationEligibility } from '../eligibility.js';
import { appendTimelineEvent } from '../timeline.js';
import {
  CRM_DEMO_PARTICIPANT_ROLE,
  CRM_DEMO_PARTICIPANT_TYPE,
  isValidDemoParticipantRole,
  isValidDemoParticipantType,
} from './catalogue.js';
import {
  hasCrmDemoModel,
  hasCrmDemoParticipantModel,
  serializeDemoParticipant,
} from './model.js';
import { canEditDemos, loadDemo } from './service.js';

/**
 * Add a Demo participant.
 */
export async function addDemoParticipant(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_participant_forbidden' };
  }
  if (!hasCrmDemoModel(prisma) || !hasCrmDemoParticipantModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_participant_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  const participantType = String(args.participantType || '')
    .trim()
    .toUpperCase();
  const participantId = args.participantId
    ? String(args.participantId).trim()
    : '';
  const role = String(args.role || CRM_DEMO_PARTICIPANT_ROLE.REQUIRED)
    .trim()
    .toUpperCase();

  if (!isValidDemoParticipantType(participantType)) {
    return { ok: false, error: 'invalid_participant_type' };
  }
  if (!participantId) {
    return { ok: false, error: 'participantId_required' };
  }
  if (!isValidDemoParticipantRole(role)) {
    return { ok: false, error: 'invalid_participant_role' };
  }

  if (
    role === CRM_DEMO_PARTICIPANT_ROLE.PRESENTER &&
    participantType !== CRM_DEMO_PARTICIPANT_TYPE.ADMIN
  ) {
    return { ok: false, error: 'presenter_must_be_admin' };
  }
  if (
    role === CRM_DEMO_PARTICIPANT_ROLE.PRIMARY_CONTACT &&
    participantType !== CRM_DEMO_PARTICIPANT_TYPE.CONTACT
  ) {
    return { ok: false, error: 'primary_contact_must_be_contact' };
  }

  try {
    const existing = await prisma.crmDemoParticipant.findFirst({
      where: { demoId: demo.id, participantType, participantId, role },
    });
    if (existing) {
      return {
        ok: true,
        participant: serializeDemoParticipant(existing),
        alreadyExists: true,
      };
    }
  } catch {
    // continue
  }

  const now = args.now || new Date();
  let eligibilityJson = null;
  let invitationStatus = 'NOT_SENT';

  if (
    participantType === CRM_DEMO_PARTICIPANT_TYPE.CONTACT &&
    args.evaluateEligibility === true
  ) {
    const elig = await checkCommunicationEligibility(prisma, {
      contactId: participantId,
      purpose: CRM_CONSENT_PURPOSE.DEMO_COMMUNICATION,
      channel: CRM_COMMUNICATION_CHANNEL.EMAIL,
    });
    eligibilityJson = {
      eligible: elig.eligible,
      reasons: elig.reasons,
      consentStatus: elig.consentStatus,
      dncFlags: elig.dncFlags,
      inferred: false,
      evaluatedAt: now.toISOString(),
      channel: CRM_COMMUNICATION_CHANNEL.EMAIL,
      purpose: CRM_CONSENT_PURPOSE.DEMO_COMMUNICATION,
    };
    invitationStatus = elig.eligible ? 'REQUESTED' : 'BLOCKED_BY_CONSENT';
  }

  let row;
  try {
    row = await prisma.crmDemoParticipant.create({
      data: {
        demoId: demo.id,
        participantType,
        participantId,
        role,
        rsvpStatus: 'PENDING',
        attendanceStatus: 'UNKNOWN',
        invitationStatus,
        eligibilityJson,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    return { ok: false, error: err?.message || 'demo_participant_create_failed' };
  }

  if (
    role === CRM_DEMO_PARTICIPANT_ROLE.PRIMARY_CONTACT &&
    !demo.contactId
  ) {
    try {
      await prisma.crmDemo.update({
        where: { id: demo.id },
        data: { contactId: participantId, updatedAt: now },
      });
    } catch {
      // non-fatal
    }
  }

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: demo.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_PARTICIPANT_ADDED,
    summary: `Demo participant added (${role})`,
    payload: {
      participantType,
      participantId,
      role,
      attendanceInvented: false,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return { ok: true, participant: serializeDemoParticipant(row) };
}

/**
 * Remove a Demo participant.
 */
export async function removeDemoParticipant(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_participant_forbidden' };
  }
  if (!hasCrmDemoParticipantModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_participant_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const participantId = args.participantRecordId || args.id;
  if (!participantId) {
    return { ok: false, error: 'participant_record_id_required' };
  }

  let row = null;
  try {
    row = await prisma.crmDemoParticipant.findUnique({
      where: { id: String(participantId).trim() },
    });
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'demo_participant_not_found' };

  const now = args.now || new Date();
  try {
    await prisma.crmDemoParticipant.delete({ where: { id: row.id } });
  } catch (err) {
    return { ok: false, error: err?.message || 'demo_participant_delete_failed' };
  }

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: row.demoId,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_PARTICIPANT_REMOVED,
    summary: `Demo participant removed (${row.role})`,
    payload: {
      participantType: row.participantType,
      participantId: row.participantId,
      role: row.role,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return { ok: true, removed: serializeDemoParticipant(row) };
}

/**
 * List participants for a Demo.
 */
export async function listDemoParticipants(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !(
      access.canViewActivities ||
      access.canViewLeads ||
      access.canViewOpportunities ||
      access.canView
    )
  ) {
    return { ok: false, forbidden: true, reason: 'crm_demo_participant_view_forbidden' };
  }
  if (!hasCrmDemoParticipantModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_participant_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  let rows = [];
  try {
    rows = await prisma.crmDemoParticipant.findMany({
      where: { demoId: demo.id },
    });
  } catch (err) {
    return { ok: false, error: err?.message || 'demo_participant_list_failed' };
  }

  return {
    ok: true,
    participants: rows.map(serializeDemoParticipant),
    count: rows.length,
  };
}
