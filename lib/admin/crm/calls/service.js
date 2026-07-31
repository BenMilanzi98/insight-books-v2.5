/**
 * Call plan / manual log / complete — Phase 13 Wave 2.
 * Fail-closed on Activity create. No future Call logged as completed.
 * Outbound eligibility + DNC before create; consent-blocked → no telephony (anyway NOT_AVAILABLE).
 */

import {
  CRM_ACTIVITY_DIRECTION,
  CRM_ACTIVITY_STATUS,
  CRM_ACTIVITY_TYPE,
  CRM_CALL_OUTCOME,
  CRM_CALL_STATUS,
  CRM_COMMUNICATION_CHANNEL,
  CRM_CONSENT_PURPOSE,
  CRM_SUBJECT_TYPE,
  CRM_SUBJECT_TYPES,
  CRM_TIMELINE_EVENT_TYPE,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { checkCommunicationEligibility } from '../eligibility.js';
import { appendTimelineEvent } from '../timeline.js';
import {
  createCrmActivity,
  hasCrmActivityModel,
  transitionActivityStatus,
} from '../activities/index.js';
import {
  getCallRecordingStatus,
  getTelephonyProviderContract,
  isValidCallDirection,
  isValidCallOutcome,
} from './catalogue.js';
import { allocateCallNumber } from './numbering.js';
import { hasCrmCallModel, serializeCall } from './model.js';
import { hasCrmContactModel } from '../contacts.js';

const SUBJECT_SET = new Set(
  CRM_SUBJECT_TYPES.filter((s) => s !== CRM_SUBJECT_TYPE.ACTIVITY)
);

function canEditCalls(access) {
  return (
    access.canEditActivities ||
    access.canEditLeads ||
    access.canEditOpportunities ||
    access.canCreateLeads
  );
}

/**
 * Outbound Call/Email must resolve a Contact before eligibility / complete / SMTP.
 * INBOUND may omit Contact. When Contact model is unavailable, require contactId only.
 *
 * @returns {Promise<{ ok: true, contactId: string } | { ok: false, error: string }>}
 */
async function requireOutboundContact(prisma, contactId) {
  const id = contactId ? String(contactId).trim() : '';
  if (!id) {
    return { ok: false, error: 'CONTACT_REQUIRED' };
  }
  if (!hasCrmContactModel(prisma)) {
    return { ok: true, contactId: id };
  }
  try {
    let row = null;
    if (typeof prisma.crmContact.findUnique === 'function') {
      row = await prisma.crmContact.findUnique({ where: { id } });
    }
    if (!row && typeof prisma.crmContact.findFirst === 'function') {
      row = await prisma.crmContact.findFirst({
        where: { OR: [{ id }, { contactNumber: id }] },
      });
    }
    if (!row) {
      return { ok: false, error: 'CONTACT_IDENTITY_UNRESOLVED' };
    }
  } catch {
    return { ok: false, error: 'CONTACT_IDENTITY_UNRESOLVED' };
  }
  return { ok: true, contactId: id };
}

async function evaluateOutboundEligibility(prisma, { contactId, purpose, now }) {
  if (!contactId) {
    return {
      consentBlocked: true,
      eligibilityJson: {
        eligible: false,
        reasons: ['contactId_required'],
        consentStatus: 'UNKNOWN',
        dncFlags: [],
        inferred: false,
        evaluatedAt: now.toISOString(),
        channel: CRM_COMMUNICATION_CHANNEL.CALL,
      },
      callStatus: CRM_CALL_STATUS.BLOCKED_BY_CONSENT,
      activityStatus: CRM_ACTIVITY_STATUS.BLOCKED_BY_CONSENT,
    };
  }
  const elig = await checkCommunicationEligibility(prisma, {
    contactId,
    purpose: purpose || CRM_CONSENT_PURPOSE.SALES_CONTACT,
    channel: CRM_COMMUNICATION_CHANNEL.CALL,
  });
  const eligibilityJson = {
    eligible: elig.eligible,
    reasons: elig.reasons,
    consentStatus: elig.consentStatus,
    dncFlags: elig.dncFlags,
    inferred: false,
    evaluatedAt: now.toISOString(),
    channel: CRM_COMMUNICATION_CHANNEL.CALL,
  };
  if (!elig.eligible) {
    return {
      consentBlocked: true,
      eligibilityJson,
      callStatus: CRM_CALL_STATUS.BLOCKED_BY_CONSENT,
      activityStatus: CRM_ACTIVITY_STATUS.BLOCKED_BY_CONSENT,
    };
  }
  return {
    consentBlocked: false,
    eligibilityJson,
    callStatus: null,
    activityStatus: null,
  };
}

/**
 * Plan a future Call (status PLANNED). Never marks completed.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} args
 */
export async function planCall(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditCalls(access)) {
    return { ok: false, forbidden: true, reason: 'crm_call_plan_forbidden' };
  }

  if (!hasCrmCallModel(prisma)) {
    return { ok: false, error: 'crm_call_model_unavailable', status: 'UNAVAILABLE' };
  }

  const direction = String(args.direction || CRM_ACTIVITY_DIRECTION.OUTBOUND)
    .trim()
    .toUpperCase();
  if (!isValidCallDirection(direction)) {
    return { ok: false, error: 'invalid_call_direction', direction };
  }

  const subjectType = args.subjectType
    ? String(args.subjectType).trim().toUpperCase()
    : null;
  const subjectId = args.subjectId ? String(args.subjectId).trim() : null;
  if (Boolean(subjectType) !== Boolean(subjectId)) {
    return { ok: false, error: 'subjectType_and_subjectId_required_together' };
  }
  if (subjectType && !SUBJECT_SET.has(subjectType)) {
    return { ok: false, error: 'invalid_subject_type' };
  }

  const title = args.title != null ? String(args.title).trim().slice(0, 500) : 'Planned call';
  const contactId = args.contactId ? String(args.contactId).trim() : null;
  const purpose = args.purpose
    ? String(args.purpose).trim().toUpperCase()
    : CRM_CONSENT_PURPOSE.SALES_CONTACT;
  const now = args.now || new Date();
  const scheduledAt = args.scheduledAt ? new Date(args.scheduledAt) : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    return { ok: false, error: 'invalid_scheduledAt' };
  }

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  if (idempotencyKey) {
    try {
      const existing = await prisma.crmCall.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return {
          ok: true,
          call: serializeCall(existing),
          alreadyExists: true,
          telephony: getTelephonyProviderContract(),
        };
      }
    } catch {
      // continue
    }
  }

  let callStatus = CRM_CALL_STATUS.PLANNED;
  let activityStatus = CRM_ACTIVITY_STATUS.PLANNED;
  let consentBlocked = false;
  let eligibilityJson = null;

  if (direction === CRM_ACTIVITY_DIRECTION.OUTBOUND) {
    const contactGate = await requireOutboundContact(prisma, contactId);
    if (!contactGate.ok) {
      return { ok: false, error: contactGate.error };
    }
    const gate = await evaluateOutboundEligibility(prisma, {
      contactId: contactGate.contactId,
      purpose,
      now,
    });
    consentBlocked = gate.consentBlocked;
    eligibilityJson = gate.eligibilityJson;
    if (gate.callStatus) callStatus = gate.callStatus;
    if (gate.activityStatus) activityStatus = gate.activityStatus;
  }

  const allocated = await allocateCallNumber(prisma, { now });
  if (!allocated.ok) {
    return { ok: false, error: allocated.error || 'call_number_allocation_failed' };
  }

  let activity = null;
  if (hasCrmActivityModel(prisma)) {
    const actResult = await createCrmActivity(prisma, {
      admin: args.admin,
      type: CRM_ACTIVITY_TYPE.CALL,
      status: activityStatus,
      direction,
      title,
      ownerAdminId: args.ownerAdminId || args.admin?.id || null,
      dueAt: scheduledAt,
      primarySubjectType: subjectType,
      primarySubjectId: subjectId,
      now,
    });
    if (!actResult.ok) {
      return {
        ok: false,
        error: actResult.error || 'activity_create_failed',
        forbidden: actResult.forbidden,
        reason: actResult.reason,
      };
    }
    activity = actResult.activity;
  }

  const row = await prisma.crmCall.create({
    data: {
      callNumber: allocated.number,
      activityId: activity?.id || null,
      direction,
      status: callStatus,
      outcome: null,
      contactId,
      subjectType,
      subjectId,
      phoneNumber: args.phoneNumber != null ? String(args.phoneNumber).trim().slice(0, 80) : null,
      scheduledAt: scheduledAt && !Number.isNaN(scheduledAt.getTime()) ? scheduledAt : null,
      completedAt: null,
      consentBlocked,
      eligibilityJson: eligibilityJson || undefined,
      notes: args.notes != null ? String(args.notes).slice(0, 4000) : null,
      ownerAdminId: args.ownerAdminId || args.admin?.id || null,
      createdByAdminId: args.admin?.id || null,
      idempotencyKey: idempotencyKey || undefined,
      createdAt: now,
      updatedAt: now,
    },
  });

  if (subjectType && subjectId) {
    await appendTimelineEvent(prisma, {
      subjectType,
      subjectId,
      eventType: CRM_TIMELINE_EVENT_TYPE.CALL_PLANNED,
      summary: `Call planned: ${title.slice(0, 120)}`,
      payload: {
        callId: row.id,
        callNumber: row.callNumber,
        activityId: activity?.id || null,
        status: callStatus,
        telephonyConnected: false,
        recordingStatus: getCallRecordingStatus(),
      },
      actorAdminId: args.admin?.id || null,
      at: now,
    });
  }

  return {
    ok: true,
    call: serializeCall(row),
    activity,
    telephony: getTelephonyProviderContract(),
  };
}

/**
 * Log a manual Call as completed (past/now only). Future timestamps blocked.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} args
 */
export async function logManualCall(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditCalls(access)) {
    return { ok: false, forbidden: true, reason: 'crm_call_log_forbidden' };
  }

  if (!hasCrmCallModel(prisma)) {
    return { ok: false, error: 'crm_call_model_unavailable', status: 'UNAVAILABLE' };
  }

  const direction = String(args.direction || CRM_ACTIVITY_DIRECTION.OUTBOUND)
    .trim()
    .toUpperCase();
  if (!isValidCallDirection(direction)) {
    return { ok: false, error: 'invalid_call_direction', direction };
  }

  const outcome = String(args.outcome || CRM_CALL_OUTCOME.OTHER).trim().toUpperCase();
  if (!isValidCallOutcome(outcome)) {
    return { ok: false, error: 'invalid_call_outcome', outcome };
  }

  const now = args.now || new Date();
  const completedAt = args.completedAt ? new Date(args.completedAt) : now;
  if (Number.isNaN(completedAt.getTime())) {
    return { ok: false, error: 'invalid_completedAt' };
  }
  // Planned ≠ completed; never log a future Call as completed
  if (completedAt.getTime() > now.getTime() + 60_000) {
    return { ok: false, error: 'future_call_cannot_be_completed' };
  }

  const subjectType = args.subjectType
    ? String(args.subjectType).trim().toUpperCase()
    : null;
  const subjectId = args.subjectId ? String(args.subjectId).trim() : null;
  if (Boolean(subjectType) !== Boolean(subjectId)) {
    return { ok: false, error: 'subjectType_and_subjectId_required_together' };
  }
  if (subjectType && !SUBJECT_SET.has(subjectType)) {
    return { ok: false, error: 'invalid_subject_type' };
  }

  const title = args.title != null ? String(args.title).trim().slice(0, 500) : 'Manual call';
  const contactId = args.contactId ? String(args.contactId).trim() : null;
  const purpose = args.purpose
    ? String(args.purpose).trim().toUpperCase()
    : CRM_CONSENT_PURPOSE.SALES_CONTACT;

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  if (idempotencyKey) {
    try {
      const existing = await prisma.crmCall.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return {
          ok: true,
          call: serializeCall(existing),
          alreadyExists: true,
          telephony: getTelephonyProviderContract(),
        };
      }
    } catch {
      // continue
    }
  }

  let callStatus = CRM_CALL_STATUS.COMPLETED;
  let activityStatus = CRM_ACTIVITY_STATUS.COMPLETED;
  let consentBlocked = false;
  let eligibilityJson = null;

  if (direction === CRM_ACTIVITY_DIRECTION.OUTBOUND) {
    const contactGate = await requireOutboundContact(prisma, contactId);
    if (!contactGate.ok) {
      return { ok: false, error: contactGate.error };
    }
    const gate = await evaluateOutboundEligibility(prisma, {
      contactId: contactGate.contactId,
      purpose,
      now,
    });
    consentBlocked = gate.consentBlocked;
    eligibilityJson = gate.eligibilityJson;
    if (gate.consentBlocked) {
      callStatus = CRM_CALL_STATUS.BLOCKED_BY_CONSENT;
      activityStatus = CRM_ACTIVITY_STATUS.BLOCKED_BY_CONSENT;
    }
  }

  // Consent-blocked outbound → persist decision; do not invent completed connect
  if (consentBlocked) {
    const allocated = await allocateCallNumber(prisma, { now });
    if (!allocated.ok) {
      return { ok: false, error: allocated.error || 'call_number_allocation_failed' };
    }
    let activity = null;
    if (hasCrmActivityModel(prisma)) {
      const actResult = await createCrmActivity(prisma, {
        admin: args.admin,
        type: CRM_ACTIVITY_TYPE.CALL,
        status: activityStatus,
        direction,
        title,
        outcome: null,
        ownerAdminId: args.ownerAdminId || args.admin?.id || null,
        primarySubjectType: subjectType,
        primarySubjectId: subjectId,
        now,
      });
      if (!actResult.ok) {
        return {
          ok: false,
          error: actResult.error || 'activity_create_failed',
          forbidden: actResult.forbidden,
          reason: actResult.reason,
        };
      }
      activity = actResult.activity;
    }
    const row = await prisma.crmCall.create({
      data: {
        callNumber: allocated.number,
        activityId: activity?.id || null,
        direction,
        status: callStatus,
        outcome: null,
        contactId,
        subjectType,
        subjectId,
        phoneNumber:
          args.phoneNumber != null ? String(args.phoneNumber).trim().slice(0, 80) : null,
        scheduledAt: null,
        completedAt: null,
        consentBlocked: true,
        eligibilityJson: eligibilityJson || undefined,
        notes: args.notes != null ? String(args.notes).slice(0, 4000) : null,
        ownerAdminId: args.ownerAdminId || args.admin?.id || null,
        createdByAdminId: args.admin?.id || null,
        idempotencyKey: idempotencyKey || undefined,
        createdAt: now,
        updatedAt: now,
      },
    });
    return {
      ok: true,
      call: serializeCall(row),
      activity,
      blocked: true,
      telephony: getTelephonyProviderContract(),
    };
  }

  const allocated = await allocateCallNumber(prisma, { now });
  if (!allocated.ok) {
    return { ok: false, error: allocated.error || 'call_number_allocation_failed' };
  }

  let activity = null;
  if (hasCrmActivityModel(prisma)) {
    const actResult = await createCrmActivity(prisma, {
      admin: args.admin,
      type: CRM_ACTIVITY_TYPE.CALL,
      status: activityStatus,
      direction,
      title,
      outcome,
      ownerAdminId: args.ownerAdminId || args.admin?.id || null,
      primarySubjectType: subjectType,
      primarySubjectId: subjectId,
      now,
    });
    if (!actResult.ok) {
      return {
        ok: false,
        error: actResult.error || 'activity_create_failed',
        forbidden: actResult.forbidden,
        reason: actResult.reason,
      };
    }
    activity = actResult.activity;
  }

  const row = await prisma.crmCall.create({
    data: {
      callNumber: allocated.number,
      activityId: activity?.id || null,
      direction,
      status: callStatus,
      outcome,
      contactId,
      subjectType,
      subjectId,
      phoneNumber:
        args.phoneNumber != null ? String(args.phoneNumber).trim().slice(0, 80) : null,
      scheduledAt: null,
      completedAt,
      consentBlocked: false,
      eligibilityJson: eligibilityJson || undefined,
      notes: args.notes != null ? String(args.notes).slice(0, 4000) : null,
      ownerAdminId: args.ownerAdminId || args.admin?.id || null,
      createdByAdminId: args.admin?.id || null,
      idempotencyKey: idempotencyKey || undefined,
      createdAt: now,
      updatedAt: now,
    },
  });

  if (subjectType && subjectId) {
    await appendTimelineEvent(prisma, {
      subjectType,
      subjectId,
      eventType: CRM_TIMELINE_EVENT_TYPE.CALL_LOGGED,
      summary: `Call logged: ${title.slice(0, 120)}`,
      payload: {
        callId: row.id,
        callNumber: row.callNumber,
        activityId: activity?.id || null,
        outcome,
        telephonyConnected: false,
        recordingStatus: getCallRecordingStatus(),
      },
      actorAdminId: args.admin?.id || null,
      at: now,
    });
  }

  return {
    ok: true,
    call: serializeCall(row),
    activity,
    telephony: getTelephonyProviderContract(),
  };
}

/**
 * Complete a planned Call (idempotent if already COMPLETED).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} args
 */
export async function completeCall(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditCalls(access)) {
    return { ok: false, forbidden: true, reason: 'crm_call_complete_forbidden' };
  }

  if (!hasCrmCallModel(prisma)) {
    return { ok: false, error: 'crm_call_model_unavailable', status: 'UNAVAILABLE' };
  }

  const callId = args.callId ? String(args.callId).trim() : '';
  if (!callId) return { ok: false, error: 'callId_required' };

  const row = await prisma.crmCall.findUnique({ where: { id: callId } });
  if (!row) return { ok: false, error: 'call_not_found' };

  if (row.status === CRM_CALL_STATUS.COMPLETED) {
    return {
      ok: true,
      call: serializeCall(row),
      alreadyCompleted: true,
      telephony: getTelephonyProviderContract(),
    };
  }

  if (row.status === CRM_CALL_STATUS.BLOCKED_BY_CONSENT) {
    return { ok: false, error: 'call_blocked_by_consent' };
  }

  if (row.status === CRM_CALL_STATUS.CANCELLED) {
    return { ok: false, error: 'call_cancelled' };
  }

  const outcome = String(args.outcome || CRM_CALL_OUTCOME.OTHER).trim().toUpperCase();
  if (!isValidCallOutcome(outcome)) {
    return { ok: false, error: 'invalid_call_outcome', outcome };
  }

  const now = args.now || new Date();
  const completedAt = args.completedAt ? new Date(args.completedAt) : now;
  if (Number.isNaN(completedAt.getTime())) {
    return { ok: false, error: 'invalid_completedAt' };
  }
  if (completedAt.getTime() > now.getTime() + 60_000) {
    return { ok: false, error: 'future_call_cannot_be_completed' };
  }

  // Outbound complete requires Contact + fresh eligibility (no bypass when omitted)
  if (row.direction === CRM_ACTIVITY_DIRECTION.OUTBOUND) {
    const contactGate = await requireOutboundContact(prisma, row.contactId);
    if (!contactGate.ok) {
      return {
        ok: false,
        error: contactGate.error,
        call: serializeCall(row),
        telephony: getTelephonyProviderContract(),
      };
    }
    const gate = await evaluateOutboundEligibility(prisma, {
      contactId: contactGate.contactId,
      purpose: CRM_CONSENT_PURPOSE.SALES_CONTACT,
      now,
    });
    if (gate.consentBlocked) {
      const blocked = await prisma.crmCall.update({
        where: { id: callId },
        data: {
          status: CRM_CALL_STATUS.BLOCKED_BY_CONSENT,
          consentBlocked: true,
          eligibilityJson: gate.eligibilityJson,
          updatedAt: now,
        },
      });
      if (row.activityId && hasCrmActivityModel(prisma)) {
        await transitionActivityStatus(prisma, {
          admin: args.admin,
          activityId: row.activityId,
          toStatus: CRM_ACTIVITY_STATUS.BLOCKED_BY_CONSENT,
          reason: 'call_consent_blocked',
          now,
        });
      }
      return {
        ok: false,
        error: 'call_blocked_by_consent',
        call: serializeCall(blocked),
        telephony: getTelephonyProviderContract(),
      };
    }
  }

  const updated = await prisma.crmCall.update({
    where: { id: callId },
    data: {
      status: CRM_CALL_STATUS.COMPLETED,
      outcome,
      completedAt,
      notes:
        args.notes != null ? String(args.notes).slice(0, 4000) : row.notes,
      updatedAt: now,
    },
  });

  if (row.activityId && hasCrmActivityModel(prisma)) {
    await transitionActivityStatus(prisma, {
      admin: args.admin,
      activityId: row.activityId,
      toStatus: CRM_ACTIVITY_STATUS.COMPLETED,
      reason: 'call_completed',
      now,
    });
  }

  if (row.subjectType && row.subjectId) {
    await appendTimelineEvent(prisma, {
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      eventType: CRM_TIMELINE_EVENT_TYPE.CALL_COMPLETED,
      summary: `Call completed: ${String(row.callNumber || callId).slice(0, 120)}`,
      payload: {
        callId: updated.id,
        callNumber: updated.callNumber,
        activityId: row.activityId || null,
        outcome,
        telephonyConnected: false,
        recordingStatus: getCallRecordingStatus(),
      },
      actorAdminId: args.admin?.id || null,
      at: now,
    });
  }

  return {
    ok: true,
    call: serializeCall(updated),
    telephony: getTelephonyProviderContract(),
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} args
 */
export async function listCalls(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canView &&
    !access.canViewLeads &&
    !access.canViewOpportunities &&
    !access.canViewActivities
  ) {
    return { ok: false, forbidden: true, reason: 'crm_call_list_forbidden' };
  }

  if (!hasCrmCallModel(prisma)) {
    return {
      ok: false,
      error: 'crm_call_model_unavailable',
      status: 'UNAVAILABLE',
      items: [],
    };
  }

  const where = {};
  if (args.subjectType) where.subjectType = String(args.subjectType).trim().toUpperCase();
  if (args.subjectId) where.subjectId = String(args.subjectId).trim();
  if (args.status) where.status = String(args.status).trim().toUpperCase();
  if (args.activityId) where.activityId = String(args.activityId).trim();

  const take = Math.min(
    Math.max(Number(args.limit) || 50, 1),
    100
  );
  const skip = Math.max(Number(args.offset) || 0, 0);

  const rows = await prisma.crmCall.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    skip,
  });

  return {
    ok: true,
    items: rows.map(serializeCall),
    telephony: getTelephonyProviderContract(),
  };
}

export { getTelephonyProviderContract, getCallRecordingStatus };
