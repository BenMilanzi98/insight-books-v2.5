/**
 * Phase 16 Closed-Won conversion handoff — Phase 15 Wave 4.
 * Payload only. NEVER creates Customer / Tenant / Subscription / Invoice.
 * NEVER mutates Opportunity stage / probability / close date.
 */

import { CRM_READINESS_STATUS, CRM_TIMELINE_EVENT_TYPE } from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { getCommercialDomainContract } from './catalogue.js';
import { hasCrmCommercialAcceptanceModel } from './model.js';
import {
  evaluateClosedWonReadiness,
  hasCrmClosedWonConversionHandoffModel,
  CLOSED_WON_READINESS_VERSION,
} from './readiness.js';

export const PHASE16_CONVERSION_HANDOFF_TYPE = 'CRM_CLOSED_WON_CONVERSION_HANDOFF';
export const PHASE16_CONVERSION_HANDOFF_VERSION =
  'crm-closed-won-conversion-handoff-v1-2026-07-31';

export function serializeClosedWonHandoff(row) {
  if (!row) return null;
  return {
    id: row.id,
    acceptanceId: row.acceptanceId,
    documentVersionId: row.documentVersionId || null,
    opportunityId: row.opportunityId || null,
    payloadJson: row.payloadJson ?? null,
    idempotencyKey: row.idempotencyKey || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    customerCreated: false,
    tenantCreated: false,
    subscriptionCreated: false,
    invoiceCreated: false,
    paymentCreated: false,
  };
}

function rejectProvisionFlags(args) {
  if (
    args.createCustomer === true ||
    args.createTenant === true ||
    args.createSubscription === true ||
    args.createInvoice === true ||
    args.provisionTenant === true ||
    args.executeConversion === true
  ) {
    return {
      ok: false,
      error: 'handoff_create_forbidden',
      domain: getCommercialDomainContract(),
    };
  }
  return null;
}

/**
 * Create Closed-Won → Phase 16 conversion handoff (payload only).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ actorContext?: { admin?: object }, admin?: object, acceptanceId: string, idempotencyKey?: string }} args
 */
export async function createClosedWonConversionHandoff(prisma, args = {}) {
  const admin = args.actorContext?.admin || args.admin || null;
  const access = resolveCrmAccess(admin);
  if (!access.canEditOpportunities && !access.isSuperAdmin) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_closed_won_handoff_forbidden',
    };
  }

  const provisionReject = rejectProvisionFlags(args);
  if (provisionReject) return provisionReject;

  if (!hasCrmCommercialAcceptanceModel(prisma)) {
    return {
      ok: false,
      error: 'crm_commercial_acceptance_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  if (!hasCrmClosedWonConversionHandoffModel(prisma)) {
    return {
      ok: false,
      error: 'crm_closed_won_handoff_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const acceptanceId = args.acceptanceId ? String(args.acceptanceId).trim() : '';
  if (!acceptanceId) return { ok: false, error: 'acceptanceId_required' };

  const readiness = await evaluateClosedWonReadiness(prisma, {
    acceptanceId,
    admin,
  });
  if (!readiness.ok) return readiness;

  if (
    readiness.readinessStatus !== CRM_READINESS_STATUS.READY &&
    readiness.readinessStatus !== CRM_READINESS_STATUS.HANDED_OFF
  ) {
    return {
      ok: false,
      error: 'closed_won_not_ready',
      readinessStatus: readiness.readinessStatus,
      checklist: readiness.checklist,
      domain: getCommercialDomainContract(),
    };
  }

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : `closed-won-handoff:${acceptanceId}`;

  const existing = await prisma.crmClosedWonConversionHandoff.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return {
      ok: true,
      handoff: serializeClosedWonHandoff(existing),
      payload: existing.payloadJson,
      alreadyExists: true,
      idempotentReplay: true,
      customerCreated: false,
      tenantCreated: false,
      subscriptionCreated: false,
      invoiceCreated: false,
      paymentCreated: false,
      opportunityMutated: false,
      domain: getCommercialDomainContract(),
    };
  }

  // Also idempotent by acceptanceId if prior handoff exists under another key
  const priorByAcceptance = await prisma.crmClosedWonConversionHandoff.findFirst({
    where: { acceptanceId },
    orderBy: { createdAt: 'desc' },
  });
  if (priorByAcceptance) {
    return {
      ok: true,
      handoff: serializeClosedWonHandoff(priorByAcceptance),
      payload: priorByAcceptance.payloadJson,
      alreadyExists: true,
      idempotentReplay: true,
      customerCreated: false,
      tenantCreated: false,
      subscriptionCreated: false,
      invoiceCreated: false,
      paymentCreated: false,
      opportunityMutated: false,
      domain: getCommercialDomainContract(),
    };
  }

  const acceptance = await prisma.crmCommercialAcceptance.findUnique({
    where: { id: acceptanceId },
  });
  if (!acceptance) {
    return { ok: false, notFound: true, error: 'acceptance_not_found' };
  }

  let document = null;
  let version = null;
  if (typeof prisma.crmCommercialDocumentVersion?.findUnique === 'function') {
    version = await prisma.crmCommercialDocumentVersion.findUnique({
      where: { id: acceptance.documentVersionId },
    });
  }
  if (
    version?.documentId &&
    typeof prisma.crmCommercialDocument?.findUnique === 'function'
  ) {
    document = await prisma.crmCommercialDocument.findUnique({
      where: { id: version.documentId },
    });
  }

  const now = args.now || new Date();
  const opportunityId = document?.opportunityId || null;

  const payload = {
    type: PHASE16_CONVERSION_HANDOFF_TYPE,
    version: PHASE16_CONVERSION_HANDOFF_VERSION,
    readinessVersion: CLOSED_WON_READINESS_VERSION,
    readinessStatus: CRM_READINESS_STATUS.READY,
    acceptanceId,
    documentVersionId: acceptance.documentVersionId,
    artifactId: acceptance.artifactId,
    checksumSha256: acceptance.checksumSha256,
    authorityRole: acceptance.authorityRole,
    recipientId: acceptance.recipientId,
    acceptedAt: acceptance.acceptedAt
      ? new Date(acceptance.acceptedAt).toISOString()
      : null,
    documentId: document?.id || null,
    documentNumber: document?.documentNumber || null,
    documentFamily: document?.documentFamily || null,
    opportunityId,
    accountId: document?.accountId || null,
    contactId: document?.contactId || null,
    currency: document?.currency || version?.contentJson?.totals?.currency || null,
    pricingSnapshot: version?.contentJson?.totals || null,
    lineItems: version?.contentJson?.lineItems || null,
    idempotencyKey,
    emittedByAdminId: admin?.id || null,
    emittedAt: now.toISOString(),
    /** Honesty — Phase 15 never creates these */
    customerId: null,
    customerCreated: false,
    tenantId: null,
    tenantCreated: false,
    subscriptionId: null,
    subscriptionCreated: false,
    invoiceId: null,
    invoiceCreated: false,
    paymentId: null,
    paymentCreated: false,
    conversionExecuted: false,
    inventConversionForbidden: true,
    opportunityStageMutated: false,
    opportunityProbabilityMutated: false,
    opportunityCloseDateMutated: false,
    closedWonAutoApplied: false,
    eventTypeHint: CRM_TIMELINE_EVENT_TYPE.CLOSED_WON_CONVERSION_HANDOFF,
  };

  const row = await prisma.crmClosedWonConversionHandoff.create({
    data: {
      acceptanceId,
      documentVersionId: acceptance.documentVersionId,
      opportunityId,
      payloadJson: payload,
      idempotencyKey,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  // Explicit: do NOT update Opportunity stage/probability/closeDate

  // Phase 16 Wave 1 — seed Conversion Request (CVR) idempotently from handoff
  let conversionRequest = null;
  try {
    const { createConversionRequestFromClosedWonHandoff } = await import(
      '../conversions/requests.js'
    );
    const cvr = await createConversionRequestFromClosedWonHandoff(prisma, {
      admin,
      actorContext: args.actorContext || { admin },
      handoff: row,
      acceptanceId,
      idempotencyKey: `cvr-from-handoff:${acceptanceId}`,
      now,
    });
    if (cvr?.ok) {
      conversionRequest = cvr.request;
    }
  } catch {
    // CVR model may be unavailable pre-Wave-1 SQL; handoff still succeeds
  }

  return {
    ok: true,
    handoff: serializeClosedWonHandoff(row),
    payload,
    conversionRequest,
    customerCreated: false,
    tenantCreated: false,
    subscriptionCreated: false,
    invoiceCreated: false,
    paymentCreated: false,
    opportunityMutated: false,
    domain: getCommercialDomainContract(),
  };
}
