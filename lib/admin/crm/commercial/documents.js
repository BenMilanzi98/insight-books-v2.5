/**
 * CrmCommercialDocument create/get/list — Phase 15 Wave 1 spine.
 */

import { CRM_SUBJECT_TYPE, CRM_TIMELINE_EVENT_TYPE } from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { appendTimelineEvent } from '../timeline.js';
import {
  CRM_COMMERCIAL_DOCUMENT_FAMILY,
  CRM_COMMERCIAL_DOCUMENT_STATUS,
  getCommercialDomainContract,
} from './catalogue.js';
import {
  allocateProposalNumber,
  allocateQuotationNumber,
  formatDocumentVersionLabel,
} from './numbering.js';
import {
  hasCrmCommercialDocumentModel,
  hasCrmCommercialDocumentVersionModel,
  hasCrmProposalModel,
  hasCrmQuotationModel,
  resolveCommercialActor,
  serializeCommercialDocument,
  serializeDocumentVersion,
  serializeProposal,
  serializeQuotation,
} from './model.js';

function canEditCommercial(access) {
  return access.canEditOpportunities || access.canEditLeads || access.canCreateLeads;
}

function canViewCommercial(access) {
  return (
    access.canViewOpportunities ||
    access.canViewLeads ||
    access.canView ||
    access.canViewActivities
  );
}

export async function loadCommercialDocument(prisma, documentId) {
  const id = documentId ? String(documentId).trim() : '';
  if (!id || !hasCrmCommercialDocumentModel(prisma)) return null;
  try {
    if (/^(PROP|QUO)-\d{4}-\d{6}$/.test(id)) {
      return await prisma.crmCommercialDocument.findUnique({
        where: { documentNumber: id },
      });
    }
    return await prisma.crmCommercialDocument.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/**
 * Internal create of commercial document + draft V1 + typed extension.
 */
export async function createCommercialDocument(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canEditCommercial(access)) {
    return { ok: false, forbidden: true, reason: 'crm_commercial_document_create_forbidden' };
  }
  if (
    !hasCrmCommercialDocumentModel(prisma) ||
    !hasCrmCommercialDocumentVersionModel(prisma)
  ) {
    return {
      ok: false,
      error: 'crm_commercial_document_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const family = String(args.documentFamily || '')
    .trim()
    .toUpperCase();
  if (
    family !== CRM_COMMERCIAL_DOCUMENT_FAMILY.PROPOSAL &&
    family !== CRM_COMMERCIAL_DOCUMENT_FAMILY.QUOTATION
  ) {
    return { ok: false, error: 'invalid_document_family' };
  }

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  if (idempotencyKey) {
    try {
      const existing = await prisma.crmCommercialDocument.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        const version = existing.currentVersionId
          ? await prisma.crmCommercialDocumentVersion.findUnique({
              where: { id: existing.currentVersionId },
            })
          : await prisma.crmCommercialDocumentVersion.findFirst({
              where: { documentId: existing.id },
              orderBy: { versionNumber: 'desc' },
            });
        return {
          ok: true,
          document: serializeCommercialDocument(existing),
          version: serializeDocumentVersion(version),
          alreadyExists: true,
          domain: getCommercialDomainContract(),
        };
      }
    } catch {
      // continue
    }
  }

  if (args.convertIdempotencyKey) {
    try {
      const byConvert = await prisma.crmCommercialDocument.findUnique({
        where: { convertIdempotencyKey: String(args.convertIdempotencyKey).trim() },
      });
      if (byConvert) {
        const version = byConvert.currentVersionId
          ? await prisma.crmCommercialDocumentVersion.findUnique({
              where: { id: byConvert.currentVersionId },
            })
          : await prisma.crmCommercialDocumentVersion.findFirst({
              where: { documentId: byConvert.id },
              orderBy: { versionNumber: 'desc' },
            });
        return {
          ok: true,
          document: serializeCommercialDocument(byConvert),
          version: serializeDocumentVersion(version),
          alreadyExists: true,
          domain: getCommercialDomainContract(),
        };
      }
    } catch {
      // continue
    }
  }

  const now = args.now || new Date();
  const allocated =
    family === CRM_COMMERCIAL_DOCUMENT_FAMILY.PROPOSAL
      ? await allocateProposalNumber(prisma, { now })
      : await allocateQuotationNumber(prisma, { now });
  if (!allocated.ok) {
    return { ok: false, error: allocated.error || 'commercial_number_allocation_failed' };
  }

  const title =
    args.title != null
      ? String(args.title).trim().slice(0, 500)
      : family === CRM_COMMERCIAL_DOCUMENT_FAMILY.PROPOSAL
        ? 'Proposal'
        : 'Quotation';

  let document;
  try {
    document = await prisma.crmCommercialDocument.create({
      data: {
        documentNumber: allocated.number,
        documentFamily: family,
        requestId: args.requestId ? String(args.requestId).trim() : null,
        opportunityId: args.opportunityId ? String(args.opportunityId).trim() : null,
        accountId: args.accountId ? String(args.accountId).trim() : null,
        contactId: args.contactId ? String(args.contactId).trim() : null,
        demoId: args.demoId ? String(args.demoId).trim() : null,
        leadId: args.leadId ? String(args.leadId).trim() : null,
        title,
        currency: args.currency ? String(args.currency).trim().slice(0, 12) : null,
        ownerAdminId: args.ownerAdminId || admin?.id || null,
        createdByAdminId: admin?.id || null,
        latestVersionNumber: 1,
        convertIdempotencyKey: args.convertIdempotencyKey
          ? String(args.convertIdempotencyKey).trim()
          : null,
        idempotencyKey,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    if (idempotencyKey || args.convertIdempotencyKey) {
      const raced = idempotencyKey
        ? await prisma.crmCommercialDocument.findUnique({ where: { idempotencyKey } })
        : await prisma.crmCommercialDocument.findUnique({
            where: {
              convertIdempotencyKey: String(args.convertIdempotencyKey).trim(),
            },
          });
      if (raced) {
        return {
          ok: true,
          document: serializeCommercialDocument(raced),
          alreadyExists: true,
          domain: getCommercialDomainContract(),
        };
      }
    }
    return { ok: false, error: err?.message || 'commercial_document_create_failed' };
  }

  const versionLabel = formatDocumentVersionLabel(document.documentNumber, 1);
  const version = await prisma.crmCommercialDocumentVersion.create({
    data: {
      documentId: document.id,
      versionNumber: 1,
      versionLabel,
      status: CRM_COMMERCIAL_DOCUMENT_STATUS.DRAFT,
      contentJson: args.contentJson ?? null,
      revisionReason: args.revisionReason || 'initial',
      immutable: false,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  document = await prisma.crmCommercialDocument.update({
    where: { id: document.id },
    data: {
      currentVersionId: version.id,
      latestVersionNumber: 1,
      updatedAt: now,
    },
  });

  let proposal = null;
  let quotation = null;

  if (family === CRM_COMMERCIAL_DOCUMENT_FAMILY.PROPOSAL && hasCrmProposalModel(prisma)) {
    proposal = await prisma.crmProposal.create({
      data: {
        documentId: document.id,
        title,
        narrativeJson: args.narrativeJson ?? null,
        scopesJson: args.scopesJson ?? null,
        assumptionsJson: args.assumptionsJson ?? null,
        exclusionsJson: args.exclusionsJson ?? null,
        responsibilitiesJson: args.responsibilitiesJson ?? null,
        milestonesJson: args.milestonesJson ?? null,
        pinnedQuotationVersionIds: args.pinnedQuotationVersionIds ?? null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  if (family === CRM_COMMERCIAL_DOCUMENT_FAMILY.QUOTATION && hasCrmQuotationModel(prisma)) {
    quotation = await prisma.crmQuotation.create({
      data: {
        documentId: document.id,
        currency: args.currency ? String(args.currency).trim().slice(0, 12) : null,
        lineItemsJson: args.lineItemsJson ?? null,
        pricingSnapshotJson: null,
        totalsJson: null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  await appendTimelineEvent(prisma, {
    subjectType: document.opportunityId
      ? CRM_SUBJECT_TYPE.OPPORTUNITY
      : CRM_SUBJECT_TYPE.ACCOUNT,
    subjectId: document.opportunityId || document.accountId || document.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.COMMERCIAL_DOCUMENT_CREATED,
    summary: `Commercial document ${document.documentNumber} created (V1 draft)`,
    payload: {
      documentId: document.id,
      documentNumber: document.documentNumber,
      documentFamily: family,
      versionId: version.id,
    },
    actorAdminId: admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    document: serializeCommercialDocument(document),
    version: serializeDocumentVersion(version),
    proposal: proposal ? serializeProposal(proposal) : undefined,
    quotation: quotation ? serializeQuotation(quotation) : undefined,
    domain: getCommercialDomainContract(),
  };
}

export async function getCommercialDocument(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canViewCommercial(access)) {
    return { ok: false, forbidden: true, reason: 'crm_commercial_document_view_forbidden' };
  }
  const document = await loadCommercialDocument(prisma, args.documentId);
  if (!document) return { ok: false, notFound: true, error: 'commercial_document_not_found' };

  let version = null;
  if (document.currentVersionId) {
    version = await prisma.crmCommercialDocumentVersion.findUnique({
      where: { id: document.currentVersionId },
    });
  }

  let proposal = null;
  let quotation = null;
  if (
    document.documentFamily === CRM_COMMERCIAL_DOCUMENT_FAMILY.PROPOSAL &&
    hasCrmProposalModel(prisma)
  ) {
    proposal = await prisma.crmProposal.findUnique({ where: { documentId: document.id } });
  }
  if (
    document.documentFamily === CRM_COMMERCIAL_DOCUMENT_FAMILY.QUOTATION &&
    hasCrmQuotationModel(prisma)
  ) {
    quotation = await prisma.crmQuotation.findUnique({ where: { documentId: document.id } });
  }

  return {
    ok: true,
    document: serializeCommercialDocument(document),
    version: serializeDocumentVersion(version),
    proposal: proposal ? serializeProposal(proposal) : undefined,
    quotation: quotation ? serializeQuotation(quotation) : undefined,
    domain: getCommercialDomainContract(),
  };
}

export async function listCommercialDocuments(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canViewCommercial(access)) {
    return { ok: false, forbidden: true, reason: 'crm_commercial_document_view_forbidden' };
  }
  if (!hasCrmCommercialDocumentModel(prisma)) {
    return {
      ok: false,
      error: 'crm_commercial_document_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const where = {};
  if (args.documentFamily) where.documentFamily = String(args.documentFamily).trim().toUpperCase();
  if (args.requestId) where.requestId = String(args.requestId).trim();
  if (args.opportunityId) where.opportunityId = String(args.opportunityId).trim();

  const rows = await prisma.crmCommercialDocument.findMany({ where });
  return {
    ok: true,
    documents: rows.map(serializeCommercialDocument),
    domain: getCommercialDomainContract(),
  };
}

export { canEditCommercial, canViewCommercial };
