/**
 * Commercial document + proposal request status transitions — Phase 15 Wave 1.
 * Invalid document transitions throw (visible failure).
 */

import { CRM_SUBJECT_TYPE, CRM_TIMELINE_EVENT_TYPE } from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { appendTimelineEvent } from '../timeline.js';
import {
  canTransitionCommercialDocumentStatus,
  canTransitionProposalRequestStatus,
  CRM_COMMERCIAL_DOCUMENT_STATUS,
  getCommercialDomainContract,
  isIssuedOrBeyond,
  isValidCommercialDocumentStatus,
} from './catalogue.js';
import { canEditCommercial } from './documents.js';
import {
  hasCrmCommercialDocumentVersionStatusHistoryModel,
  hasCrmProposalRequestStatusHistoryModel,
  resolveCommercialActor,
  serializeDocumentVersion,
  serializeProposalRequest,
} from './model.js';
import { loadDocumentVersion } from './versions.js';

/**
 * Transition document version status. Invalid → throw.
 * Marks immutable when entering ISSUED-or-beyond.
 */
export async function transitionDocumentStatus(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canEditCommercial(access)) {
    const err = new Error('crm_commercial_status_forbidden');
    err.forbidden = true;
    throw err;
  }

  const version = await loadDocumentVersion(prisma, args.documentVersionId);
  if (!version) {
    throw new Error('document_version_not_found');
  }

  const toStatus = String(args.toStatus || '')
    .trim()
    .toUpperCase();
  if (!isValidCommercialDocumentStatus(toStatus)) {
    throw new Error(`invalid_document_status: ${toStatus}`);
  }

  if (version.status === toStatus) {
    return {
      ok: true,
      version: serializeDocumentVersion(version),
      alreadyInStatus: true,
      domain: getCommercialDomainContract(),
    };
  }

  if (!canTransitionCommercialDocumentStatus(version.status, toStatus)) {
    throw new Error(
      `invalid_status_transition: cannot transition from ${version.status} to ${toStatus}`
    );
  }

  const now = args.now || new Date();
  const fromStatus = version.status;
  const immutable = isIssuedOrBeyond(toStatus);

  const updated = await prisma.crmCommercialDocumentVersion.update({
    where: { id: version.id },
    data: {
      status: toStatus,
      immutable,
      updatedAt: now,
    },
  });

  if (hasCrmCommercialDocumentVersionStatusHistoryModel(prisma)) {
    await prisma.crmCommercialDocumentVersionStatusHistory.create({
      data: {
        versionId: version.id,
        fromStatus,
        toStatus,
        reason: args.reason != null ? String(args.reason).trim().slice(0, 1000) : null,
        changedByAdminId: admin?.id || null,
        at: now,
      },
    });
  }

  const document = await prisma.crmCommercialDocument.findUnique({
    where: { id: version.documentId },
  });

  await appendTimelineEvent(prisma, {
    subjectType: document?.opportunityId
      ? CRM_SUBJECT_TYPE.OPPORTUNITY
      : CRM_SUBJECT_TYPE.ACCOUNT,
    subjectId: document?.opportunityId || document?.accountId || version.documentId,
    eventType: CRM_TIMELINE_EVENT_TYPE.COMMERCIAL_DOCUMENT_STATUS_CHANGED,
    summary: `Document version ${version.versionLabel}: ${fromStatus} → ${toStatus}`,
    payload: {
      versionId: version.id,
      fromStatus,
      toStatus,
      approvedEqualsIssued: false,
      immutable,
    },
    actorAdminId: admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    version: serializeDocumentVersion(updated),
    domain: getCommercialDomainContract(),
  };
}

/**
 * Soft request-status helper (returns result objects; used by qualify/reject).
 */
export async function transitionProposalRequestStatus(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canEditCommercial(access)) {
    return { ok: false, forbidden: true, reason: 'crm_proposal_request_status_forbidden' };
  }

  const id = args.requestId ? String(args.requestId).trim() : '';
  if (!id) return { ok: false, error: 'request_id_required' };

  let row;
  try {
    if (/^PRQ-\d{4}-\d{6}$/.test(id)) {
      row = await prisma.crmProposalRequest.findUnique({ where: { requestNumber: id } });
    } else {
      row = await prisma.crmProposalRequest.findUnique({ where: { id } });
    }
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'proposal_request_not_found' };

  const toStatus = String(args.toStatus || '')
    .trim()
    .toUpperCase();
  if (row.status === toStatus) {
    return {
      ok: true,
      request: serializeProposalRequest(row),
      alreadyInStatus: true,
    };
  }
  if (!canTransitionProposalRequestStatus(row.status, toStatus)) {
    return {
      ok: false,
      error: 'invalid_request_status_transition',
      fromStatus: row.status,
      toStatus,
    };
  }

  const now = args.now || new Date();
  const fromStatus = row.status;
  const data = {
    status: toStatus,
    updatedAt: now,
    ...(args.patch || {}),
  };

  const updated = await prisma.crmProposalRequest.update({
    where: { id: row.id },
    data,
  });

  if (hasCrmProposalRequestStatusHistoryModel(prisma)) {
    await prisma.crmProposalRequestStatusHistory.create({
      data: {
        requestId: row.id,
        fromStatus,
        toStatus,
        reason: args.reason != null ? String(args.reason).trim().slice(0, 1000) : null,
        changedByAdminId: admin?.id || null,
        at: now,
      },
    });
  }

  return {
    ok: true,
    request: serializeProposalRequest(updated),
    domain: getCommercialDomainContract(),
  };
}

export { CRM_COMMERCIAL_DOCUMENT_STATUS };
