/**
 * Proposal Requests — Phase 15 Wave 1.
 * Convert → CommercialDocument + Proposal and/or Quotation draft V1 (idempotent).
 * Never mutates Opportunity stage/probability/close date.
 * Never reuses tenant Quotation domain.
 */

import { CRM_SUBJECT_TYPE, CRM_TIMELINE_EVENT_TYPE } from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { appendTimelineEvent } from '../timeline.js';
import {
  CRM_PROPOSAL_REQUEST_SOURCE,
  CRM_PROPOSAL_REQUEST_STATUS,
  CRM_REQUESTED_DOCUMENT_TYPE,
  getCommercialDomainContract,
} from './catalogue.js';
import { createProposal } from './proposals.js';
import { createQuotation } from './quotations.js';
import { allocateProposalRequestNumber } from './numbering.js';
import {
  hasCrmCommercialDocumentModel,
  hasCrmProposalRequestModel,
  resolveCommercialActor,
  serializeCommercialDocument,
  serializeProposalRequest,
} from './model.js';
import { canEditCommercial, canViewCommercial } from './documents.js';
import { transitionProposalRequestStatus } from './status.js';

async function loadRequest(prisma, requestId) {
  const id = requestId ? String(requestId).trim() : '';
  if (!id || !hasCrmProposalRequestModel(prisma)) return null;
  try {
    if (/^PRQ-\d{4}-\d{6}$/.test(id)) {
      return await prisma.crmProposalRequest.findUnique({ where: { requestNumber: id } });
    }
    return await prisma.crmProposalRequest.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/**
 * Create a Proposal Request (PRQ-YYYY-######).
 */
export async function createProposalRequest(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canEditCommercial(access)) {
    return { ok: false, forbidden: true, reason: 'crm_proposal_request_create_forbidden' };
  }
  if (!hasCrmProposalRequestModel(prisma)) {
    return {
      ok: false,
      error: 'crm_proposal_request_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const now = args.now || new Date();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;

  if (idempotencyKey) {
    try {
      const existing = await prisma.crmProposalRequest.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return {
          ok: true,
          request: serializeProposalRequest(existing),
          alreadyExists: true,
          proposalCreated: false,
          domain: getCommercialDomainContract(),
        };
      }
    } catch {
      // continue
    }
  }

  const allocated = await allocateProposalRequestNumber(prisma, { now });
  if (!allocated.ok) {
    return {
      ok: false,
      error: allocated.error || 'proposal_request_number_allocation_failed',
    };
  }

  const requestedDocumentType = String(
    args.requestedDocumentType || CRM_REQUESTED_DOCUMENT_TYPE.PROPOSAL
  )
    .trim()
    .toUpperCase();
  const title =
    args.title != null ? String(args.title).trim().slice(0, 500) : 'Proposal request';

  let row;
  try {
    row = await prisma.crmProposalRequest.create({
      data: {
        requestNumber: allocated.number,
        status: CRM_PROPOSAL_REQUEST_STATUS.NEW,
        source: args.source ? String(args.source).trim().slice(0, 80) : null,
        sourceRef: args.sourceRef != null ? String(args.sourceRef).trim().slice(0, 200) : null,
        opportunityId: args.opportunityId ? String(args.opportunityId).trim() : null,
        accountId: args.accountId ? String(args.accountId).trim() : null,
        contactId: args.contactId ? String(args.contactId).trim() : null,
        demoId: args.demoId ? String(args.demoId).trim() : null,
        leadId: args.leadId ? String(args.leadId).trim() : null,
        requestedDocumentType,
        currency: args.currency ? String(args.currency).trim().slice(0, 12) : null,
        title,
        notes: args.notes != null ? String(args.notes).trim().slice(0, 4000) : null,
        ownerAdminId: args.ownerAdminId || admin?.id || null,
        createdByAdminId: admin?.id || null,
        idempotencyKey,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    if (idempotencyKey) {
      try {
        const raced = await prisma.crmProposalRequest.findUnique({
          where: { idempotencyKey },
        });
        if (raced) {
          return {
            ok: true,
            request: serializeProposalRequest(raced),
            alreadyExists: true,
            proposalCreated: false,
            domain: getCommercialDomainContract(),
          };
        }
      } catch {
        // fall through
      }
    }
    return { ok: false, error: err?.message || 'proposal_request_create_failed' };
  }

  await appendTimelineEvent(prisma, {
    subjectType: row.opportunityId
      ? CRM_SUBJECT_TYPE.OPPORTUNITY
      : row.demoId
        ? CRM_SUBJECT_TYPE.DEMO
        : CRM_SUBJECT_TYPE.ACCOUNT,
    subjectId: row.opportunityId || row.demoId || row.accountId || row.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.PROPOSAL_REQUEST_CREATED,
    summary: `Proposal request ${row.requestNumber} created`,
    payload: {
      requestId: row.id,
      requestNumber: row.requestNumber,
      proposalCreated: false,
    },
    actorAdminId: admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    request: serializeProposalRequest(row),
    proposalCreated: false,
    domain: getCommercialDomainContract(),
  };
}

/**
 * Consume Demo proposal handoff → create PRQ idempotently by handoff identity.
 * Does NOT create Proposal/Quotation until convert.
 */
export async function createProposalRequestFromDemoHandoff(prisma, args = {}) {
  const payload = args.handoffPayload || args.payload || {};
  const handoffKey =
    args.idempotencyKey ||
    payload.idempotencyKey ||
    (payload.demoId ? `demo-proposal-handoff:${payload.demoId}` : null);

  if (!handoffKey) {
    return { ok: false, error: 'demo_handoff_idempotency_key_required' };
  }

  return createProposalRequest(prisma, {
    ...args,
    source: CRM_PROPOSAL_REQUEST_SOURCE.DEMO_HANDOFF,
    sourceRef: handoffKey,
    demoId: payload.demoId || args.demoId,
    opportunityId: payload.opportunityId || args.opportunityId,
    accountId: payload.accountId || args.accountId,
    contactId: payload.contactId || args.contactId,
    leadId: payload.leadId || args.leadId,
    currency: args.currency || payload.currency || null,
    requestedDocumentType:
      args.requestedDocumentType || CRM_REQUESTED_DOCUMENT_TYPE.PROPOSAL,
    title:
      args.title ||
      (payload.demoNumber
        ? `Proposal request from ${payload.demoNumber}`
        : 'Proposal request from Demo handoff'),
    idempotencyKey: `prq-from-handoff:${handoffKey}`,
  });
}

/**
 * Seed PRQ from Opp proposal readiness without creating Proposal document.
 */
export async function seedProposalRequestFromOpportunityReadiness(prisma, args = {}) {
  const readiness = args.readiness || args.handoffPayload || {};
  const opportunityId = args.opportunityId || readiness.opportunityId;
  if (!opportunityId) return { ok: false, error: 'opportunity_id_required' };

  const idempotencyKey =
    args.idempotencyKey ||
    readiness.idempotencyKey ||
    `prq-from-opp-readiness:${opportunityId}`;

  return createProposalRequest(prisma, {
    ...args,
    source: CRM_PROPOSAL_REQUEST_SOURCE.OPPORTUNITY_READINESS,
    sourceRef: idempotencyKey,
    opportunityId,
    accountId: args.accountId || readiness.accountId,
    contactId: args.contactId || readiness.contactId,
    leadId: args.leadId || readiness.leadId,
    currency: args.currency || readiness.currency || null,
    requestedDocumentType:
      args.requestedDocumentType || CRM_REQUESTED_DOCUMENT_TYPE.PROPOSAL,
    title:
      args.title ||
      (readiness.opportunityNumber
        ? `Proposal request for ${readiness.opportunityNumber}`
        : 'Proposal request from opportunity readiness'),
    idempotencyKey: `prq-seed:${idempotencyKey}`,
  });
}

export async function qualifyProposalRequest(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canEditCommercial(access)) {
    return { ok: false, forbidden: true, reason: 'crm_proposal_request_qualify_forbidden' };
  }
  if (!hasCrmProposalRequestModel(prisma)) {
    return {
      ok: false,
      error: 'crm_proposal_request_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const row = await loadRequest(prisma, args.requestId);
  if (!row) return { ok: false, notFound: true, error: 'proposal_request_not_found' };

  if (row.status === CRM_PROPOSAL_REQUEST_STATUS.QUALIFIED) {
    return {
      ok: true,
      request: serializeProposalRequest(row),
      alreadyQualified: true,
    };
  }
  if (row.status === CRM_PROPOSAL_REQUEST_STATUS.CONVERTED) {
    return { ok: false, error: 'proposal_request_already_converted' };
  }
  if (
    row.status !== CRM_PROPOSAL_REQUEST_STATUS.NEW &&
    row.status !== CRM_PROPOSAL_REQUEST_STATUS.UNDER_REVIEW &&
    row.status !== CRM_PROPOSAL_REQUEST_STATUS.INFORMATION_REQUIRED
  ) {
    return {
      ok: false,
      error: 'proposal_request_not_qualifiable',
      status: row.status,
    };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmProposalRequest.update({
    where: { id: row.id },
    data: {
      status: CRM_PROPOSAL_REQUEST_STATUS.QUALIFIED,
      qualifiedAt: now,
      updatedAt: now,
    },
  });

  if (typeof prisma.crmProposalRequestStatusHistory?.create === 'function') {
    await prisma.crmProposalRequestStatusHistory.create({
      data: {
        requestId: row.id,
        fromStatus: row.status,
        toStatus: CRM_PROPOSAL_REQUEST_STATUS.QUALIFIED,
        reason: args.reason || 'qualified',
        changedByAdminId: admin?.id || null,
        at: now,
      },
    });
  }

  await appendTimelineEvent(prisma, {
    subjectType: updated.opportunityId
      ? CRM_SUBJECT_TYPE.OPPORTUNITY
      : CRM_SUBJECT_TYPE.DEMO,
    subjectId: updated.opportunityId || updated.demoId || updated.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.PROPOSAL_REQUEST_QUALIFIED,
    summary: `Proposal request ${updated.requestNumber} qualified`,
    payload: { requestId: updated.id },
    actorAdminId: admin?.id || null,
    at: now,
  });

  return { ok: true, request: serializeProposalRequest(updated) };
}

export async function rejectProposalRequest(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canEditCommercial(access)) {
    return { ok: false, forbidden: true, reason: 'crm_proposal_request_reject_forbidden' };
  }
  if (!hasCrmProposalRequestModel(prisma)) {
    return {
      ok: false,
      error: 'crm_proposal_request_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const row = await loadRequest(prisma, args.requestId);
  if (!row) return { ok: false, notFound: true, error: 'proposal_request_not_found' };

  if (row.status === CRM_PROPOSAL_REQUEST_STATUS.REJECTED) {
    return {
      ok: true,
      request: serializeProposalRequest(row),
      alreadyRejected: true,
    };
  }
  if (row.status === CRM_PROPOSAL_REQUEST_STATUS.CONVERTED) {
    return { ok: false, error: 'proposal_request_already_converted' };
  }

  const now = args.now || new Date();
  const reason =
    args.reason != null ? String(args.reason).trim().slice(0, 1000) : null;

  const transitioned = await transitionProposalRequestStatus(prisma, {
    actorContext: args.actorContext,
    admin,
    requestId: row.id,
    toStatus: CRM_PROPOSAL_REQUEST_STATUS.REJECTED,
    reason,
    now,
    patch: {
      rejectedReason: reason,
      rejectedAt: now,
    },
  });
  if (!transitioned.ok) return transitioned;

  const updated = transitioned.request;
  await appendTimelineEvent(prisma, {
    subjectType: updated.opportunityId
      ? CRM_SUBJECT_TYPE.OPPORTUNITY
      : CRM_SUBJECT_TYPE.DEMO,
    subjectId: updated.opportunityId || updated.demoId || updated.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.PROPOSAL_REQUEST_REJECTED,
    summary: `Proposal request ${updated.requestNumber} rejected`,
    payload: { requestId: updated.id, reason },
    actorAdminId: admin?.id || null,
    at: now,
  });

  return { ok: true, request: updated };
}

/**
 * Convert QUALIFIED/APPROVED Proposal Request → CommercialDocument(s) + typed drafts.
 * Exact retry returns same documents. Never mutates Opportunity.
 */
export async function convertProposalRequest(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canEditCommercial(access)) {
    return { ok: false, forbidden: true, reason: 'crm_proposal_request_convert_forbidden' };
  }
  if (!hasCrmProposalRequestModel(prisma) || !hasCrmCommercialDocumentModel(prisma)) {
    return {
      ok: false,
      error: 'crm_commercial_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const row = await loadRequest(prisma, args.requestId);
  if (!row) return { ok: false, notFound: true, error: 'proposal_request_not_found' };

  const convertKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : `prq-convert:${row.id}`;

  const wantProposal =
    args.createProposal !== false &&
    (args.createProposal === true ||
      row.requestedDocumentType === CRM_REQUESTED_DOCUMENT_TYPE.PROPOSAL ||
      row.requestedDocumentType === CRM_REQUESTED_DOCUMENT_TYPE.BOTH ||
      !row.requestedDocumentType);
  const wantQuotation =
    args.createQuotation === true ||
    row.requestedDocumentType === CRM_REQUESTED_DOCUMENT_TYPE.QUOTATION ||
    row.requestedDocumentType === CRM_REQUESTED_DOCUMENT_TYPE.BOTH;

  // Idempotent replay
  if (row.status === CRM_PROPOSAL_REQUEST_STATUS.CONVERTED) {
    let proposalDoc = null;
    let quotationDoc = null;
    if (row.convertedProposalDocumentId) {
      proposalDoc = await prisma.crmCommercialDocument.findUnique({
        where: { id: row.convertedProposalDocumentId },
      });
    }
    if (row.convertedQuotationDocumentId) {
      quotationDoc = await prisma.crmCommercialDocument.findUnique({
        where: { id: row.convertedQuotationDocumentId },
      });
    }
    if (!proposalDoc) {
      proposalDoc = await prisma.crmCommercialDocument.findUnique({
        where: { convertIdempotencyKey: `${convertKey}:PROP` },
      });
    }
    if (!quotationDoc) {
      quotationDoc = await prisma.crmCommercialDocument.findUnique({
        where: { convertIdempotencyKey: `${convertKey}:QUO` },
      });
    }
    if (proposalDoc || quotationDoc) {
      return {
        ok: true,
        request: serializeProposalRequest(row),
        proposal: proposalDoc ? serializeCommercialDocument(proposalDoc) : undefined,
        quotation: quotationDoc ? serializeCommercialDocument(quotationDoc) : undefined,
        alreadyExists: true,
        proposalCreated: Boolean(proposalDoc),
        quotationCreated: Boolean(quotationDoc),
        opportunityMutated: false,
        domain: getCommercialDomainContract(),
      };
    }
  }

  if (
    row.status !== CRM_PROPOSAL_REQUEST_STATUS.QUALIFIED &&
    row.status !== CRM_PROPOSAL_REQUEST_STATUS.APPROVED &&
    row.status !== CRM_PROPOSAL_REQUEST_STATUS.CONVERTED
  ) {
    return {
      ok: false,
      error: 'proposal_request_must_be_qualified',
      status: row.status,
    };
  }

  if (!wantProposal && !wantQuotation) {
    return { ok: false, error: 'convert_requires_proposal_or_quotation' };
  }

  const now = args.now || new Date();
  let proposalResult = null;
  let quotationResult = null;
  let alreadyExists = false;

  if (wantProposal) {
    proposalResult = await createProposal(prisma, {
      actorContext: args.actorContext,
      admin,
      title: args.title || row.title || `Proposal from ${row.requestNumber}`,
      opportunityId: row.opportunityId,
      accountId: row.accountId,
      contactId: row.contactId,
      demoId: row.demoId,
      leadId: row.leadId,
      requestId: row.id,
      currency: row.currency,
      ownerAdminId: args.ownerAdminId || row.ownerAdminId || admin?.id,
      convertIdempotencyKey: `${convertKey}:PROP`,
      idempotencyKey: `${convertKey}:PROP`,
      now,
    });
    if (!proposalResult.ok && !proposalResult.alreadyExists) return proposalResult;
    if (proposalResult.alreadyExists) alreadyExists = true;
  }

  if (wantQuotation) {
    quotationResult = await createQuotation(prisma, {
      actorContext: args.actorContext,
      admin,
      title: args.quotationTitle || `Quotation from ${row.requestNumber}`,
      opportunityId: row.opportunityId,
      accountId: row.accountId,
      contactId: row.contactId,
      demoId: row.demoId,
      leadId: row.leadId,
      requestId: row.id,
      currency: row.currency || args.currency,
      ownerAdminId: args.ownerAdminId || row.ownerAdminId || admin?.id,
      convertIdempotencyKey: `${convertKey}:QUO`,
      idempotencyKey: `${convertKey}:QUO`,
      now,
    });
    if (!quotationResult.ok && !quotationResult.alreadyExists) return quotationResult;
    if (quotationResult.alreadyExists) alreadyExists = true;
  }

  const proposalDoc = proposalResult?.document || null;
  const quotationDoc = quotationResult?.document || null;
  const convertPatch = {
    convertedProposalDocumentId: proposalDoc?.id || row.convertedProposalDocumentId || null,
    convertedQuotationDocumentId:
      quotationDoc?.id || row.convertedQuotationDocumentId || null,
    convertIdempotencyKey: convertKey,
    convertedAt: row.convertedAt || now,
  };

  let updated;
  if (row.status === CRM_PROPOSAL_REQUEST_STATUS.CONVERTED) {
    // Already terminal: patch document links only (no status transition / history).
    updated = serializeProposalRequest(
      await prisma.crmProposalRequest.update({
        where: { id: row.id },
        data: { ...convertPatch, updatedAt: now },
      })
    );
  } else {
    const transitioned = await transitionProposalRequestStatus(prisma, {
      actorContext: args.actorContext,
      admin,
      requestId: row.id,
      toStatus: CRM_PROPOSAL_REQUEST_STATUS.CONVERTED,
      reason: args.reason || 'converted',
      now,
      patch: convertPatch,
    });
    if (!transitioned.ok) return transitioned;
    updated = transitioned.request;
  }

  if (!alreadyExists) {
    await appendTimelineEvent(prisma, {
      subjectType: CRM_SUBJECT_TYPE.OPPORTUNITY,
      subjectId: updated.opportunityId || updated.id,
      eventType: CRM_TIMELINE_EVENT_TYPE.PROPOSAL_REQUEST_CONVERTED,
      summary: `Proposal request ${updated.requestNumber} converted`,
      payload: {
        requestId: updated.id,
        proposalDocumentId: proposalDoc?.id || null,
        quotationDocumentId: quotationDoc?.id || null,
        opportunityMutated: false,
      },
      actorAdminId: admin?.id || null,
      at: now,
    });
  }

  return {
    ok: true,
    request: updated,
    proposal: proposalDoc || undefined,
    quotation: quotationDoc || undefined,
    proposalVersion: proposalResult?.version,
    quotationVersion: quotationResult?.version,
    alreadyExists,
    proposalCreated: Boolean(proposalDoc),
    quotationCreated: Boolean(quotationDoc),
    opportunityMutated: false,
    domain: getCommercialDomainContract(),
  };
}

export async function listProposalRequests(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canViewCommercial(access)) {
    return { ok: false, forbidden: true, reason: 'crm_proposal_request_view_forbidden' };
  }
  if (!hasCrmProposalRequestModel(prisma)) {
    return {
      ok: false,
      error: 'crm_proposal_request_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const where = {};
  if (args.status) where.status = String(args.status).trim().toUpperCase();
  if (args.opportunityId) where.opportunityId = String(args.opportunityId).trim();
  if (args.ownerAdminId) where.ownerAdminId = String(args.ownerAdminId).trim();

  const rows = await prisma.crmProposalRequest.findMany({ where });
  return {
    ok: true,
    requests: rows.map(serializeProposalRequest),
    domain: getCommercialDomainContract(),
  };
}
