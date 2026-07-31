/**
 * Opportunity readiness — Phase 11 Wave 4.
 * Checklist → NOT_READY | PARTIALLY_READY | READY | BLOCKED.
 * Builds typed handoff payload. NEVER creates Opportunity / Pipeline / Revenue.
 * Lead status OPPORTUNITY_READY only when checklist READY.
 */

import {
  CRM_CONSENT_PURPOSE,
  CRM_CONSENT_STATUS,
  CRM_DEFAULT_QUALIFICATION_VERSION_ID,
  CRM_DUPLICATE_STATUS,
  CRM_LEAD_STATUS,
  CRM_QUALIFICATION_RESPONSE,
  CRM_READINESS_STATUS,
  CRM_TIMELINE_EVENT_TYPE,
  CRM_WAVE4_DEFINITION_VERSION,
} from './catalogue.js';
import { resolveCrmAccess } from './authz.js';
import { appendTimelineEvent } from './timeline.js';
import { transitionLeadStatus } from './leads.js';
import { getDefaultQualificationDefinition } from './qualification/catalogue.js';
import { checkCommunicationEligibility } from './eligibility.js';

const OPEN_DUP_STATUSES = new Set([
  CRM_DUPLICATE_STATUS.NEW,
  CRM_DUPLICATE_STATUS.UNDER_REVIEW,
  CRM_DUPLICATE_STATUS.LIKELY_DUPLICATE,
]);

function item(key, ok, severity, detail, blocker = false) {
  return {
    key,
    ok: Boolean(ok),
    severity: severity || (ok ? 'INFO' : 'WARN'),
    detail: detail || null,
    blocker: Boolean(blocker),
  };
}

function deriveStatus(items) {
  const blockers = items.filter((i) => i.blocker && !i.ok);
  if (blockers.some((b) => b.severity === 'CRITICAL')) {
    return CRM_READINESS_STATUS.BLOCKED;
  }
  if (blockers.length > 0) {
    return CRM_READINESS_STATUS.BLOCKED;
  }
  const failed = items.filter((i) => !i.ok);
  if (failed.length === 0) return CRM_READINESS_STATUS.READY;
  const requiredFailed = failed.filter((i) => i.severity !== 'INFO');
  if (requiredFailed.length === 0) return CRM_READINESS_STATUS.PARTIALLY_READY;
  const allSoft = requiredFailed.every((i) => i.severity === 'WARN');
  if (allSoft && requiredFailed.length < items.length) {
    return CRM_READINESS_STATUS.PARTIALLY_READY;
  }
  return CRM_READINESS_STATUS.NOT_READY;
}

async function loadLead(prisma, leadId) {
  if (typeof prisma?.crmLead?.findUnique !== 'function') return null;
  try {
    return await prisma.crmLead.findUnique({ where: { id: String(leadId) } });
  } catch {
    return null;
  }
}

/**
 * Evaluate opportunity readiness for a Lead. Never creates Opportunity.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   leadId: string,
 *   allowUnknownProductInterest?: boolean,
 *   accountContactExceptionReason?: string|null,
 *   markReady?: boolean,
 *   now?: Date,
 * }} args
 */
export async function evaluateOpportunityReadiness(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewLeads) {
    return { ok: false, forbidden: true, reason: 'crm_view_forbidden' };
  }

  const leadId = args.leadId ? String(args.leadId).trim() : '';
  if (!leadId) return { ok: false, error: 'leadId_required' };

  const lead = await loadLead(prisma, leadId);
  if (!lead) return { ok: false, notFound: true, error: 'lead_not_found' };

  const items = [];

  /** 1. Qualified status */
  const isQualified =
    lead.status === CRM_LEAD_STATUS.QUALIFIED ||
    lead.status === CRM_LEAD_STATUS.OPPORTUNITY_READY;
  items.push(
    item(
      'qualified',
      isQualified,
      isQualified ? 'INFO' : 'CRITICAL',
      isQualified
        ? `Lead status is ${lead.status}`
        : `Lead must be QUALIFIED (current: ${lead.status})`,
      !isQualified
    )
  );

  /** 2. Account + primary contact (or documented exception) */
  const hasAccount = Boolean(lead.accountId);
  const hasContact = Boolean(lead.contactId);
  const exceptionReason =
    args.accountContactExceptionReason != null
      ? String(args.accountContactExceptionReason).trim()
      : '';
  const linkOk = (hasAccount && hasContact) || Boolean(exceptionReason);
  items.push(
    item(
      'account_primary_contact',
      linkOk,
      linkOk ? 'INFO' : 'CRITICAL',
      linkOk
        ? exceptionReason
          ? `Exception documented: ${exceptionReason}`
          : 'Account and primary contact linked'
        : 'Account + primary contact required (or documented exception)',
      !linkOk
    )
  );

  /** 3. Product interest (FIT / NEED) — UNKNOWN blocks READY unless explicit allow */
  let productInterestState = CRM_QUALIFICATION_RESPONSE.UNKNOWN;
  let qualificationVersionId = CRM_DEFAULT_QUALIFICATION_VERSION_ID;
  if (typeof prisma?.crmQualificationResponse?.findMany === 'function') {
    try {
      const def = getDefaultQualificationDefinition();
      qualificationVersionId = def.versionId || qualificationVersionId;
      const responses = await prisma.crmQualificationResponse.findMany({
        where: { leadId: lead.id, definitionVersionId: qualificationVersionId },
        take: 50,
      });
      const byKey = new Map((responses || []).map((r) => [r.criterionKey, r.state]));
      productInterestState =
        byKey.get('FIT') || byKey.get('NEED') || CRM_QUALIFICATION_RESPONSE.UNKNOWN;
    } catch {
      productInterestState = CRM_QUALIFICATION_RESPONSE.UNKNOWN;
    }
  }

  const allowUnknown = args.allowUnknownProductInterest === true;
  const productOk =
    productInterestState !== CRM_QUALIFICATION_RESPONSE.UNKNOWN || allowUnknown;
  items.push(
    item(
      'product_interest',
      productOk,
      productOk ? 'INFO' : 'WARN',
      productOk
        ? allowUnknown && productInterestState === CRM_QUALIFICATION_RESPONSE.UNKNOWN
          ? 'Product interest UNKNOWN allowed by checklist exception'
          : `Product interest: ${productInterestState}`
        : 'Product interest UNKNOWN — blocker for READY unless exception allowed',
      !productOk
    )
  );

  /** 4. Duplicate review — CRITICAL open blocks */
  let criticalDupOpen = false;
  let openDupCount = null;
  if (typeof prisma?.crmDuplicateCandidate?.findMany === 'function') {
    try {
      const dups = await prisma.crmDuplicateCandidate.findMany({
        where: {
          OR: [{ leadId: lead.id }, { candidateLeadId: lead.id }],
          status: { in: [...OPEN_DUP_STATUSES] },
        },
        take: 50,
      });
      openDupCount = (dups || []).length;
      criticalDupOpen = (dups || []).some(
        (d) =>
          String(d.confidence || '').toUpperCase() === 'HIGH' ||
          d.status === CRM_DUPLICATE_STATUS.LIKELY_DUPLICATE
      );
    } catch {
      openDupCount = null;
    }
  }
  items.push(
    item(
      'duplicate_review',
      !criticalDupOpen,
      criticalDupOpen ? 'CRITICAL' : 'INFO',
      criticalDupOpen
        ? `CRITICAL open duplicate candidates (${openDupCount ?? '?'})`
        : openDupCount == null
          ? 'Duplicate model unavailable — not treated as CRITICAL open'
          : `No CRITICAL open duplicates (${openDupCount} open non-critical)`,
      criticalDupOpen
    )
  );

  /** 5. Consent / eligibility — UNKNOWN is visible blocker for READY */
  let consentStatus = CRM_CONSENT_STATUS.UNKNOWN;
  let eligibilityOk = false;
  let eligibilityDetail = 'No contact linked — consent UNKNOWN';
  if (lead.contactId && typeof prisma?.crmConsentRecord?.findUnique === 'function') {
    try {
      const consent = await prisma.crmConsentRecord.findUnique({
        where: {
          contactId_purpose: {
            contactId: lead.contactId,
            purpose: CRM_CONSENT_PURPOSE.SALES_CONTACT,
          },
        },
      });
      consentStatus = consent?.status || CRM_CONSENT_STATUS.UNKNOWN;
    } catch {
      consentStatus = CRM_CONSENT_STATUS.UNKNOWN;
    }
  }
  if (lead.contactId) {
    try {
      const elig = await checkCommunicationEligibility(prisma, {
        admin: args.admin,
        contactId: lead.contactId,
        channel: 'EMAIL',
        purpose: CRM_CONSENT_PURPOSE.SALES_CONTACT,
      });
      eligibilityOk = Boolean(elig?.eligible);
      eligibilityDetail = Array.isArray(elig?.reasons)
        ? elig.reasons.join(',') || (eligibilityOk ? 'eligible' : 'not_eligible')
        : elig?.reason || (eligibilityOk ? 'eligible' : 'not_eligible');
      if (elig?.consentStatus) consentStatus = elig.consentStatus;
    } catch {
      eligibilityOk = false;
      eligibilityDetail = 'eligibility_check_failed';
    }
  }
  // READY requires full eligibility (GRANTED/NOT_REQUIRED + no DNC on channel).
  // EXPIRED / PENDING / UNKNOWN / DENIED / WITHDRAWN / DNC → not eligible.
  items.push(
    item(
      'consent_eligibility',
      eligibilityOk,
      eligibilityOk ? 'INFO' : 'CRITICAL',
      `Consent ${consentStatus}; eligibility: ${eligibilityDetail}`,
      !eligibilityOk
    )
  );

  const readinessStatus = deriveStatus(items);

  /** Latest score version pin (never invent score) */
  let scoreVersionId = null;
  let scoreEvaluationId = null;
  if (typeof prisma?.crmScoreEvaluation?.findFirst === 'function') {
    try {
      const latest = await prisma.crmScoreEvaluation.findFirst({
        where: { leadId: lead.id },
        orderBy: { createdAt: 'desc' },
      });
      if (latest) {
        scoreVersionId = latest.definitionVersionId;
        scoreEvaluationId = latest.id;
      }
    } catch {
      scoreVersionId = null;
    }
  }

  const idempotencyKey = `opp-ready:${lead.id}:${qualificationVersionId}:${scoreVersionId || 'none'}`;

  const handoffPayload = {
    type: 'CRM_OPPORTUNITY_HANDOFF',
    version: CRM_WAVE4_DEFINITION_VERSION,
    readinessStatus,
    leadId: lead.id,
    leadNumber: lead.leadNumber,
    accountId: lead.accountId || null,
    contactId: lead.contactId || null,
    source: lead.source || null,
    channel: lead.channel || null,
    scoreVersionId: scoreVersionId || null,
    scoreEvaluationId,
    qualificationVersionId,
    idempotencyKey,
    accountContactExceptionReason: exceptionReason || null,
    allowUnknownProductInterest: allowUnknown,
    /** Explicit honesty — Phase 12 consumes; Phase 11 never creates these */
    opportunityId: null,
    opportunityCreated: false,
    pipelineCreated: false,
    revenueInvented: false,
    isProbability: false,
    isExpectedRevenue: false,
  };

  const now = args.now || new Date();
  await appendTimelineEvent(prisma, {
    subjectType: 'LEAD',
    subjectId: lead.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.READINESS_EVALUATED,
    summary: `Opportunity readiness: ${readinessStatus}`,
    payload: {
      readinessStatus,
      checklistKeys: items.map((i) => i.key),
      opportunityCreated: false,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  let transition = null;
  if (
    args.markReady === true &&
    readinessStatus === CRM_READINESS_STATUS.READY &&
    lead.status === CRM_LEAD_STATUS.QUALIFIED
  ) {
    if (!access.canTransitionStatus) {
      transition = { ok: false, forbidden: true, reason: 'crm_transition_forbidden' };
    } else {
      transition = await transitionLeadStatus(prisma, {
        admin: args.admin,
        leadId: lead.id,
        toStatus: CRM_LEAD_STATUS.OPPORTUNITY_READY,
        reason: 'opportunity_readiness_ready',
        now,
      });
    }
  } else if (args.markReady === true && readinessStatus !== CRM_READINESS_STATUS.READY) {
    transition = {
      ok: false,
      error: 'not_ready_for_opportunity_ready_status',
      readinessStatus,
    };
  }

  return {
    ok: true,
    readinessStatus,
    checklist: items,
    handoffPayload,
    opportunityCreated: false,
    leadStatus: transition?.lead?.status || lead.status,
    transition,
    meta: {
      definitionVersion: CRM_WAVE4_DEFINITION_VERSION,
      inventOpportunityForbidden: true,
      inventRevenueForbidden: true,
    },
  };
}

/**
 * Pure helper for tests — never creates Opportunity.
 */
export function assertNoOpportunityCreate(result) {
  return (
    result?.opportunityCreated === false &&
    result?.handoffPayload?.opportunityId == null &&
    result?.handoffPayload?.opportunityCreated === false
  );
}

export { CRM_READINESS_STATUS };
