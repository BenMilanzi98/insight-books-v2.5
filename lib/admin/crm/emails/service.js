/**
 * Email draft / eligibility / send-request — Phase 13 Wave 2.
 * Server-side SMTP only; idempotent retries; consent-blocked → no provider call.
 * Accept ≠ delivered; never invent opens/replies; no tracking pixels.
 * Never aliases Support email threads as CRM Email Activity.
 */

import {
  CRM_ACTIVITY_DIRECTION,
  CRM_ACTIVITY_STATUS,
  CRM_ACTIVITY_TYPE,
  CRM_COMMUNICATION_CHANNEL,
  CRM_CONSENT_PURPOSE,
  CRM_EMAIL_ACTIVITY_STATUS,
  CRM_EMAIL_DELIVERY_EVENT,
  CRM_EMAIL_SEND_STATUS,
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
import { CRM_EMAIL_TRACKING_PIXELS_ENABLED } from './catalogue.js';
import {
  hasCrmEmailActivityModel,
  hasCrmEmailDeliveryEventModel,
  hasCrmEmailSendRequestModel,
  serializeEmailActivity,
  serializeSendRequest,
} from './model.js';
import { sendCrmSmtpMail } from './smtpAdapter.js';
import {
  getActiveEmailTemplate,
  renderEmailTemplateSafe,
} from './templates.js';
import { hasCrmContactModel } from '../contacts.js';

const SUBJECT_SET = new Set(
  CRM_SUBJECT_TYPES.filter((s) => s !== CRM_SUBJECT_TYPE.ACTIVITY)
);

function canEditEmails(access) {
  return (
    access.canEditActivities ||
    access.canEditLeads ||
    access.canEditOpportunities ||
    access.canCreateLeads
  );
}

/**
 * Outbound Email send requires a resolvable Contact before eligibility / SMTP.
 * When Contact model is unavailable, require contactId only.
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

/**
 * Evaluate outbound email eligibility (reuses communication gate).
 * UNKNOWN consent ≠ granted.
 */
export async function evaluateEmailSendEligibility(prisma, args = {}) {
  const contactId = args.contactId ? String(args.contactId).trim() : '';
  const purpose = args.purpose
    ? String(args.purpose).trim().toUpperCase()
    : CRM_CONSENT_PURPOSE.SALES_CONTACT;

  if (!contactId) {
    return {
      ok: false,
      eligible: false,
      error: 'CONTACT_REQUIRED',
      reasons: ['CONTACT_REQUIRED'],
      consentStatus: 'UNKNOWN',
      dncFlags: [],
      inferred: false,
    };
  }

  const elig = await checkCommunicationEligibility(prisma, {
    contactId,
    purpose,
    channel: CRM_COMMUNICATION_CHANNEL.EMAIL,
  });

  return {
    ok: elig.ok,
    eligible: elig.eligible,
    reasons: elig.reasons,
    consentStatus: elig.consentStatus,
    dncFlags: elig.dncFlags,
    purpose,
    channel: CRM_COMMUNICATION_CHANNEL.EMAIL,
    inferred: false,
    evaluatedAt: (args.now || new Date()).toISOString(),
  };
}

/** Alias per plan naming */
export const evaluateEmailEligibility = evaluateEmailSendEligibility;

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} args
 */
export async function createEmailDraft(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditEmails(access)) {
    return { ok: false, forbidden: true, reason: 'crm_email_draft_forbidden' };
  }

  if (!hasCrmEmailActivityModel(prisma)) {
    return {
      ok: false,
      error: 'crm_email_activity_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const toAddress = args.toAddress ? String(args.toAddress).trim() : '';
  if (!toAddress || !toAddress.includes('@')) {
    return { ok: false, error: 'toAddress_required' };
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

  const contactId = args.contactId ? String(args.contactId).trim() : null;
  const purpose = args.purpose
    ? String(args.purpose).trim().toUpperCase()
    : CRM_CONSENT_PURPOSE.SALES_CONTACT;
  const now = args.now || new Date();

  let subject = args.subject != null ? String(args.subject).trim().slice(0, 500) : '';
  let bodyHtml = args.bodyHtml != null ? String(args.bodyHtml) : '';
  let bodyText = args.bodyText != null ? String(args.bodyText) : '';
  let templateCode = args.templateCode
    ? String(args.templateCode).trim().toUpperCase()
    : null;
  let templateVersion = args.templateVersion != null ? Number(args.templateVersion) : null;

  if (templateCode) {
    const tpl = await getActiveEmailTemplate(prisma, {
      code: templateCode,
      version: templateVersion,
    });
    if (tpl.ok) {
      const vars = args.templateVars && typeof args.templateVars === 'object'
        ? args.templateVars
        : {};
      try {
        subject = subject || renderEmailTemplateSafe(tpl.template.subjectTemplate, vars);
        bodyHtml = bodyHtml || renderEmailTemplateSafe(tpl.template.bodyHtmlTemplate, vars);
        bodyText = bodyText || renderEmailTemplateSafe(tpl.template.bodyTextTemplate, vars);
        templateVersion = tpl.template.version;
      } catch {
        return { ok: false, error: 'executable_template_expressions_forbidden' };
      }
    }
  }

  if (!subject) return { ok: false, error: 'subject_required' };

  // Strip any accidental tracking pixel markers from drafts
  if (CRM_EMAIL_TRACKING_PIXELS_ENABLED === false && bodyHtml) {
    bodyHtml = bodyHtml.replace(
      /<img[^>]+(?:tracking|pixel|open-beacon)[^>]*>/gi,
      ''
    );
  }

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  if (idempotencyKey) {
    try {
      const existing = await prisma.crmEmailActivity.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return {
          ok: true,
          email: serializeEmailActivity(existing),
          alreadyExists: true,
        };
      }
    } catch {
      // continue
    }
  }

  let consentBlocked = false;
  let eligibilityJson = null;
  let emailStatus = CRM_EMAIL_ACTIVITY_STATUS.DRAFT;
  let activityStatus = CRM_ACTIVITY_STATUS.OPEN;

  if (contactId) {
    const elig = await evaluateEmailSendEligibility(prisma, {
      contactId,
      purpose,
      now,
    });
    eligibilityJson = {
      eligible: elig.eligible,
      reasons: elig.reasons,
      consentStatus: elig.consentStatus,
      dncFlags: elig.dncFlags,
      inferred: false,
      evaluatedAt: elig.evaluatedAt,
    };
    if (!elig.eligible) {
      consentBlocked = true;
      emailStatus = CRM_EMAIL_ACTIVITY_STATUS.BLOCKED_BY_CONSENT;
      activityStatus = CRM_ACTIVITY_STATUS.BLOCKED_BY_CONSENT;
    }
  }

  let activity = null;
  if (hasCrmActivityModel(prisma)) {
    const actResult = await createCrmActivity(prisma, {
      admin: args.admin,
      type: CRM_ACTIVITY_TYPE.EMAIL,
      status: activityStatus,
      direction: CRM_ACTIVITY_DIRECTION.OUTBOUND,
      title: subject.slice(0, 500),
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

  const row = await prisma.crmEmailActivity.create({
    data: {
      activityId: activity?.id || null,
      status: emailStatus,
      direction: CRM_ACTIVITY_DIRECTION.OUTBOUND,
      contactId,
      toAddress,
      subject,
      bodyHtml: bodyHtml || null,
      bodyText: bodyText || null,
      templateCode,
      templateVersion: templateVersion || undefined,
      subjectType,
      subjectId,
      purpose,
      consentBlocked,
      eligibilityJson: eligibilityJson || undefined,
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
      eventType: CRM_TIMELINE_EVENT_TYPE.EMAIL_DRAFT_CREATED,
      summary: `Email draft: ${subject.slice(0, 120)}`,
      payload: {
        emailActivityId: row.id,
        activityId: activity?.id || null,
        status: emailStatus,
        trackingPixels: false,
      },
      actorAdminId: args.admin?.id || null,
      at: now,
    });
  }

  return {
    ok: true,
    email: serializeEmailActivity(row),
    activity,
  };
}

async function recordDeliveryEvent(prisma, data) {
  if (!hasCrmEmailDeliveryEventModel(prisma)) return;
  try {
    await prisma.crmEmailDeliveryEvent.create({ data });
  } catch {
    // best-effort
  }
}

/**
 * Idempotent send-request. Exact retries return existing send request.
 * Consent-blocked → no SMTP call.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} args
 * @param {{ sendFn?: Function }} [deps]
 */
export async function requestEmailSend(prisma, args = {}, deps = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditEmails(access)) {
    return { ok: false, forbidden: true, reason: 'crm_email_send_forbidden' };
  }

  if (!hasCrmEmailActivityModel(prisma) || !hasCrmEmailSendRequestModel(prisma)) {
    return {
      ok: false,
      error: 'crm_email_send_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const emailActivityId = args.emailActivityId
    ? String(args.emailActivityId).trim()
    : '';
  if (!emailActivityId) return { ok: false, error: 'emailActivityId_required' };

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : `send:${emailActivityId}`;

  // Exact retry → existing send request
  try {
    const existing = await prisma.crmEmailSendRequest.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        ok: true,
        sendRequest: serializeSendRequest(existing),
        alreadyExists: true,
        delivered: false,
      };
    }
  } catch {
    // continue
  }

  const email = await prisma.crmEmailActivity.findUnique({
    where: { id: emailActivityId },
  });
  if (!email) return { ok: false, error: 'email_activity_not_found' };

  if (email.status === CRM_EMAIL_ACTIVITY_STATUS.BLOCKED_BY_CONSENT || email.consentBlocked) {
    return {
      ok: false,
      error: 'email_blocked_by_consent',
      email: serializeEmailActivity(email),
    };
  }

  const terminalOk = new Set([
    CRM_EMAIL_ACTIVITY_STATUS.DRAFT,
    CRM_EMAIL_ACTIVITY_STATUS.READY,
    CRM_EMAIL_ACTIVITY_STATUS.FAILED,
  ]);
  if (
    email.status === CRM_EMAIL_ACTIVITY_STATUS.SENT ||
    email.status === CRM_EMAIL_ACTIVITY_STATUS.ACCEPTED_BY_PROVIDER
  ) {
    return { ok: false, error: 'email_already_sent' };
  }
  if (!terminalOk.has(email.status) && email.status !== CRM_EMAIL_ACTIVITY_STATUS.SEND_REQUESTED) {
    return { ok: false, error: 'email_not_sendable', status: email.status };
  }

  const now = args.now || new Date();
  const purpose = email.purpose || CRM_CONSENT_PURPOSE.SALES_CONTACT;

  // Outbound send always requires Contact — never skip eligibility / SMTP without it
  const contactGate = await requireOutboundContact(prisma, email.contactId);
  if (!contactGate.ok) {
    return {
      ok: false,
      error: contactGate.error,
      email: serializeEmailActivity(email),
      smtpCalled: false,
    };
  }

  // Fresh eligibility before SMTP
  const elig = await evaluateEmailSendEligibility(prisma, {
    contactId: contactGate.contactId,
    purpose,
    now,
  });
  const eligibilityJson = {
    eligible: elig.eligible,
    reasons: elig.reasons,
    consentStatus: elig.consentStatus,
    dncFlags: elig.dncFlags,
    inferred: false,
    evaluatedAt: elig.evaluatedAt,
  };
  if (!elig.eligible) {
    const blocked = await prisma.crmEmailActivity.update({
      where: { id: emailActivityId },
      data: {
        status: CRM_EMAIL_ACTIVITY_STATUS.BLOCKED_BY_CONSENT,
        consentBlocked: true,
        eligibilityJson,
        updatedAt: now,
      },
    });
    if (email.activityId && hasCrmActivityModel(prisma)) {
      await transitionActivityStatus(prisma, {
        admin: args.admin,
        activityId: email.activityId,
        toStatus: CRM_ACTIVITY_STATUS.BLOCKED_BY_CONSENT,
        reason: 'email_consent_blocked',
        now,
      });
    }
    return {
      ok: false,
      error: 'email_blocked_by_consent',
      email: serializeEmailActivity(blocked),
      smtpCalled: false,
    };
  }

  const sendRequest = await prisma.crmEmailSendRequest.create({
    data: {
      emailActivityId,
      idempotencyKey,
      status: CRM_EMAIL_SEND_STATUS.REQUESTED,
      eligibilityJson: eligibilityJson || undefined,
      requestedAt: now,
      createdAt: now,
    },
  });

  await prisma.crmEmailActivity.update({
    where: { id: emailActivityId },
    data: {
      status: CRM_EMAIL_ACTIVITY_STATUS.SEND_REQUESTED,
      eligibilityJson: eligibilityJson || undefined,
      updatedAt: now,
    },
  });

  if (email.subjectType && email.subjectId) {
    await appendTimelineEvent(prisma, {
      subjectType: email.subjectType,
      subjectId: email.subjectId,
      eventType: CRM_TIMELINE_EVENT_TYPE.EMAIL_SEND_REQUESTED,
      summary: `Email send requested: ${String(email.subject || '').slice(0, 120)}`,
      payload: {
        emailActivityId,
        sendRequestId: sendRequest.id,
        trackingPixels: false,
      },
      actorAdminId: args.admin?.id || null,
      at: now,
    });
  }

  // SMTP only after eligibility cleared
  const smtpResult = await sendCrmSmtpMail(
    {
      to: email.toAddress,
      subject: email.subject,
      html: email.bodyHtml,
      text: email.bodyText,
    },
    { sendFn: deps.sendFn }
  );

  const mappedStatus = smtpResult.mappedStatus || CRM_EMAIL_SEND_STATUS.FAILED;
  const completedAt = new Date();

  const updatedRequest = await prisma.crmEmailSendRequest.update({
    where: { id: sendRequest.id },
    data: {
      status: mappedStatus,
      providerMessageId: smtpResult.messageId || null,
      providerResponse: smtpResult.response
        ? String(smtpResult.response).slice(0, 2000)
        : null,
      error: smtpResult.error || null,
      completedAt,
    },
  });

  const emailStatus =
    mappedStatus === CRM_EMAIL_SEND_STATUS.FAILED
      ? CRM_EMAIL_ACTIVITY_STATUS.FAILED
      : mappedStatus === CRM_EMAIL_SEND_STATUS.ACCEPTED_BY_PROVIDER
        ? CRM_EMAIL_ACTIVITY_STATUS.ACCEPTED_BY_PROVIDER
        : CRM_EMAIL_ACTIVITY_STATUS.SENT;

  const updatedEmail = await prisma.crmEmailActivity.update({
    where: { id: emailActivityId },
    data: {
      status: emailStatus,
      updatedAt: completedAt,
    },
  });

  const eventType =
    mappedStatus === CRM_EMAIL_SEND_STATUS.FAILED
      ? CRM_EMAIL_DELIVERY_EVENT.FAILED
      : mappedStatus === CRM_EMAIL_SEND_STATUS.ACCEPTED_BY_PROVIDER
        ? CRM_EMAIL_DELIVERY_EVENT.ACCEPTED_BY_PROVIDER
        : CRM_EMAIL_DELIVERY_EVENT.SENT;

  await recordDeliveryEvent(prisma, {
    sendRequestId: sendRequest.id,
    eventType,
    evidenceJson: {
      messageId: smtpResult.messageId || null,
      response: smtpResult.response || null,
      accepted: smtpResult.accepted || null,
      rejected: smtpResult.rejected || null,
      error: smtpResult.error || null,
      delivered: false,
    },
    at: completedAt,
  });

  // Never record DELIVERED / OPENED / REPLIED without evidence
  if (email.activityId && hasCrmActivityModel(prisma)) {
    if (mappedStatus === CRM_EMAIL_SEND_STATUS.FAILED) {
      // keep Activity OPEN/COMPLETED? Mark OPEN with failure — Activity stays OPEN
      // Spec: email failed ≠ activity fabricated complete
    } else {
      await transitionActivityStatus(prisma, {
        admin: args.admin,
        activityId: email.activityId,
        toStatus: CRM_ACTIVITY_STATUS.COMPLETED,
        reason: 'email_sent_smtp_accept',
        now: completedAt,
      });
    }
  }

  if (email.subjectType && email.subjectId) {
    await appendTimelineEvent(prisma, {
      subjectType: email.subjectType,
      subjectId: email.subjectId,
      eventType:
        mappedStatus === CRM_EMAIL_SEND_STATUS.FAILED
          ? CRM_TIMELINE_EVENT_TYPE.EMAIL_FAILED
          : CRM_TIMELINE_EVENT_TYPE.EMAIL_SENT,
      summary:
        mappedStatus === CRM_EMAIL_SEND_STATUS.FAILED
          ? `Email failed: ${String(email.subject || '').slice(0, 120)}`
          : `Email accepted by SMTP: ${String(email.subject || '').slice(0, 120)}`,
      payload: {
        emailActivityId,
        sendRequestId: sendRequest.id,
        mappedStatus,
        delivered: false,
        trackingPixels: false,
      },
      actorAdminId: args.admin?.id || null,
      at: completedAt,
    });
  }

  return {
    ok: smtpResult.ok,
    email: serializeEmailActivity(updatedEmail),
    sendRequest: serializeSendRequest(updatedRequest),
    delivered: false,
    opens: null,
    replies: null,
    smtpCalled: true,
    error: smtpResult.ok ? undefined : smtpResult.error || 'smtp_send_failed',
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} args
 */
export async function listEmailActivities(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canView &&
    !access.canViewLeads &&
    !access.canViewOpportunities &&
    !access.canViewActivities
  ) {
    return { ok: false, forbidden: true, reason: 'crm_email_list_forbidden' };
  }

  if (!hasCrmEmailActivityModel(prisma)) {
    return {
      ok: false,
      error: 'crm_email_activity_model_unavailable',
      status: 'UNAVAILABLE',
      items: [],
    };
  }

  const where = {};
  if (args.subjectType) where.subjectType = String(args.subjectType).trim().toUpperCase();
  if (args.subjectId) where.subjectId = String(args.subjectId).trim();
  if (args.status) where.status = String(args.status).trim().toUpperCase();
  if (args.activityId) where.activityId = String(args.activityId).trim();

  const take = Math.min(Math.max(Number(args.limit) || 50, 1), 100);
  const skip = Math.max(Number(args.offset) || 0, 0);

  const rows = await prisma.crmEmailActivity.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    skip,
  });

  return {
    ok: true,
    items: rows.map(serializeEmailActivity),
    trackingPixels: false,
  };
}
