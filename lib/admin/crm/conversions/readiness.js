/**
 * Phase 16 / Phase 20 conversion readiness — wraps Phase 15 Closed-Won readiness.
 * Dispatches vs Phase 12 opportunity conversion readiness by args.
 * Phase 20 Wave 1: no soft-pass on missing acceptance; UNKNOWN ≠ READY.
 */

import { evaluateClosedWonReadiness } from '../commercial/readiness.js';
import { evaluateConversionReadiness as evaluateOpportunityConversionReadiness } from '../opportunities/conversionReadiness.js';
import {
  CRM_CONVERSION_READINESS_STATUS,
  getConversionDomainContract,
} from './catalogue.js';
import {
  hasCrmConversionRequestModel,
  resolveConversionActor,
  serializeConversionRequest,
} from './model.js';
import { loadConversionRequest } from './requests.js';

const PASSING = new Set([
  CRM_CONVERSION_READINESS_STATUS.READY,
  CRM_CONVERSION_READINESS_STATUS.READY_WITH_WARNINGS,
]);

function mapPhase15Status(p15Status) {
  const s = String(p15Status || '').toUpperCase();
  if (s === 'READY') return CRM_CONVERSION_READINESS_STATUS.READY;
  if (s === 'READY_WITH_WARNINGS') {
    return CRM_CONVERSION_READINESS_STATUS.READY_WITH_WARNINGS;
  }
  if (s === 'HANDED_OFF') return CRM_CONVERSION_READINESS_STATUS.READY;
  if (s === 'APPROVAL_REQUIRED') {
    return CRM_CONVERSION_READINESS_STATUS.APPROVAL_REQUIRED;
  }
  if (s === 'DUPLICATE_REVIEW_REQUIRED') {
    return CRM_CONVERSION_READINESS_STATUS.DUPLICATE_REVIEW_REQUIRED;
  }
  if (s === 'UNKNOWN') return CRM_CONVERSION_READINESS_STATUS.UNKNOWN;
  if (s === 'BLOCKED') return CRM_CONVERSION_READINESS_STATUS.BLOCKED;
  if (s === 'PARTIALLY_READY') {
    return CRM_CONVERSION_READINESS_STATUS.PARTIALLY_READY;
  }
  return CRM_CONVERSION_READINESS_STATUS.NOT_READY;
}

function isReadyStatus(status) {
  return PASSING.has(status);
}

/**
 * Phase 20 — evaluate conversion readiness for a CVR or acceptance.
 */
export async function evaluateConversionRequestReadiness(prisma, args = {}) {
  const admin = resolveConversionActor(args);

  let request = null;
  if (args.conversionRequestId) {
    if (!hasCrmConversionRequestModel(prisma)) {
      return {
        ok: false,
        error: 'crm_conversion_request_model_unavailable',
        status: 'UNAVAILABLE',
        readinessStatus: CRM_CONVERSION_READINESS_STATUS.UNKNOWN,
      };
    }
    request = await loadConversionRequest(prisma, args.conversionRequestId);
    if (!request) {
      return {
        ok: false,
        notFound: true,
        error: 'conversion_request_not_found',
        readinessStatus: CRM_CONVERSION_READINESS_STATUS.UNKNOWN,
      };
    }
  }

  const acceptanceId =
    args.acceptanceId ||
    request?.acceptanceId ||
    null;

  if (!acceptanceId && !request) {
    return {
      ok: false,
      error: 'conversionRequestId_or_acceptanceId_required',
      readinessStatus: CRM_CONVERSION_READINESS_STATUS.UNKNOWN,
    };
  }

  const checklist = [];
  let readinessStatus = CRM_CONVERSION_READINESS_STATUS.READY;

  if (request) {
    checklist.push({
      code: 'conversion_request',
      ok: true,
      severity: 'INFO',
      detail: `CVR ${request.requestNumber}`,
    });
    if (!request.opportunityId) {
      checklist.push({
        code: 'opportunity',
        ok: false,
        severity: 'ERROR',
        detail: 'opportunityId missing',
      });
      readinessStatus = CRM_CONVERSION_READINESS_STATUS.NOT_READY;
    } else {
      checklist.push({
        code: 'opportunity',
        ok: true,
        severity: 'INFO',
        detail: request.opportunityId,
      });
    }
  }

  const resolvedAcceptance = acceptanceId || request?.acceptanceId;
  if (!resolvedAcceptance) {
    checklist.push({
      code: 'phase15_acceptance',
      ok: false,
      severity: 'ERROR',
      detail: 'acceptanceId required — handoff pin alone is not acceptance',
    });
    readinessStatus = CRM_CONVERSION_READINESS_STATUS.UNKNOWN;
  } else if (typeof evaluateClosedWonReadiness === 'function') {
    try {
      const phase15 = await evaluateClosedWonReadiness(prisma, {
        acceptanceId: resolvedAcceptance,
        admin,
        opportunityId: args.opportunityId || request?.opportunityId || null,
        requireDiscountApprovals: args.requireDiscountApprovals,
      });

      if (phase15?.ok === false && phase15?.error === 'acceptance_not_found') {
        // Phase 20: never soft-pass via handoff pin when acceptance missing
        checklist.push({
          code: 'phase15_acceptance',
          ok: false,
          severity: 'ERROR',
          detail: 'acceptance not found — handoff pin is not acceptance evidence',
        });
        readinessStatus = CRM_CONVERSION_READINESS_STATUS.UNKNOWN;
      } else if (phase15?.forbidden) {
        checklist.push({
          code: 'phase15_closed_won_readiness',
          ok: false,
          severity: 'ERROR',
          detail: phase15.reason || 'forbidden',
        });
        readinessStatus = CRM_CONVERSION_READINESS_STATUS.BLOCKED;
      } else if (phase15?.ok) {
        const p15Status = phase15.readinessStatus;
        const mapped = mapPhase15Status(p15Status);
        const pass =
          p15Status === 'READY' ||
          p15Status === 'HANDED_OFF' ||
          p15Status === 'READY_WITH_WARNINGS';
        checklist.push({
          code: 'phase15_closed_won_readiness',
          ok: pass,
          severity: pass ? 'INFO' : 'ERROR',
          detail: p15Status,
        });
        if (!pass) {
          readinessStatus = mapped;
        } else if (readinessStatus === CRM_CONVERSION_READINESS_STATUS.READY) {
          readinessStatus = mapped;
        }
      } else if (phase15 && !phase15.ok) {
        checklist.push({
          code: 'phase15_closed_won_readiness',
          ok: false,
          severity: 'ERROR',
          detail: phase15.error || 'phase15_readiness_unavailable',
        });
        readinessStatus =
          phase15.readinessStatus === 'UNKNOWN'
            ? CRM_CONVERSION_READINESS_STATUS.UNKNOWN
            : CRM_CONVERSION_READINESS_STATUS.BLOCKED;
      } else {
        checklist.push({
          code: 'phase15_closed_won_readiness',
          ok: false,
          severity: 'ERROR',
          detail: 'phase15_readiness_unknown',
        });
        readinessStatus = CRM_CONVERSION_READINESS_STATUS.UNKNOWN;
      }
    } catch (err) {
      checklist.push({
        code: 'phase15_closed_won_readiness',
        ok: false,
        severity: 'ERROR',
        detail: `phase15_readiness_exception:${String(err?.message || err)}`,
      });
      readinessStatus = CRM_CONVERSION_READINESS_STATUS.UNKNOWN;
    }
  }

  checklist.push({
    code: 'no_provision_until_execute',
    ok: true,
    severity: 'INFO',
    detail: 'Customer/Tenant/Subscription deferred to Waves 2–3',
  });

  // UNKNOWN / BLOCKED / NOT_READY / APPROVAL_REQUIRED never pass as READY
  const ok = isReadyStatus(readinessStatus);

  return {
    ok,
    readinessStatus,
    checklist,
    request: request ? serializeConversionRequest(request) : null,
    closedWon: false,
    customerCreated: false,
    tenantCreated: false,
    subscriptionCreated: false,
    invoiceCreated: false,
    domain: getConversionDomainContract(),
    meta: {
      unknownNeverReady: true,
      softPassForbidden: true,
    },
  };
}

/**
 * Unified entry: CVR/acceptance → Phase 16; opportunityId → Phase 12 soft checklist.
 */
export async function evaluateConversionReadiness(prisma, args = {}) {
  if (args.conversionRequestId || (args.acceptanceId && !args.opportunityId)) {
    return evaluateConversionRequestReadiness(prisma, args);
  }
  return evaluateOpportunityConversionReadiness(prisma, args);
}
