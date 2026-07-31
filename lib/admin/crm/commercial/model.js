/**
 * CrmCommercial* model guards + serializers — Phase 15 Wave 1.
 */

import {
  CRM_COMMERCIAL_DOCUMENT_FAMILY,
  CRM_COMMERCIAL_DOCUMENT_STATUS,
  CRM_PROPOSAL_REQUEST_STATUS,
  getCommercialDomainContract,
  isIssuedOrBeyond,
} from './catalogue.js';

export function hasCrmProposalRequestModel(prisma) {
  return typeof prisma?.crmProposalRequest?.create === 'function';
}

export function hasCrmProposalRequestStatusHistoryModel(prisma) {
  return typeof prisma?.crmProposalRequestStatusHistory?.create === 'function';
}

export function hasCrmCommercialDocumentModel(prisma) {
  return typeof prisma?.crmCommercialDocument?.create === 'function';
}

export function hasCrmCommercialDocumentVersionModel(prisma) {
  return typeof prisma?.crmCommercialDocumentVersion?.create === 'function';
}

export function hasCrmCommercialDocumentVersionStatusHistoryModel(prisma) {
  return typeof prisma?.crmCommercialDocumentVersionStatusHistory?.create === 'function';
}

export function hasCrmProposalModel(prisma) {
  return typeof prisma?.crmProposal?.create === 'function';
}

export function hasCrmQuotationModel(prisma) {
  return typeof prisma?.crmQuotation?.create === 'function';
}

export function hasCrmPriceBookModel(prisma) {
  return typeof prisma?.crmPriceBook?.create === 'function';
}

export function hasCrmPriceBookVersionModel(prisma) {
  return typeof prisma?.crmPriceBookVersion?.create === 'function';
}

export function hasCrmPriceBookEntryModel(prisma) {
  return typeof prisma?.crmPriceBookEntry?.create === 'function';
}

export function hasCrmTaxRuleModel(prisma) {
  return typeof prisma?.crmTaxRule?.create === 'function';
}

export function hasCrmTaxRateVersionModel(prisma) {
  return typeof prisma?.crmTaxRateVersion?.create === 'function';
}

export function hasCrmDiscountPolicyModel(prisma) {
  return typeof prisma?.crmDiscountPolicy?.create === 'function';
}

export function hasCrmDiscountRequestModel(prisma) {
  return typeof prisma?.crmDiscountRequest?.create === 'function';
}

export function hasCrmPricingExceptionModel(prisma) {
  return typeof prisma?.crmPricingException?.create === 'function';
}

export function hasCrmPricingSnapshotModel(prisma) {
  return typeof prisma?.crmPricingSnapshot?.create === 'function';
}

export function hasCrmApprovalPolicyModel(prisma) {
  return typeof prisma?.crmApprovalPolicy?.create === 'function';
}

export function hasCrmApprovalRequestModel(prisma) {
  return typeof prisma?.crmApprovalRequest?.create === 'function';
}

export function hasCrmApprovalStepModel(prisma) {
  return typeof prisma?.crmApprovalStep?.create === 'function';
}

export function hasCrmApprovalDecisionModel(prisma) {
  return typeof prisma?.crmApprovalDecision?.create === 'function';
}

export function hasCrmTermModel(prisma) {
  return typeof prisma?.crmTerm?.create === 'function';
}

export function hasCrmClauseModel(prisma) {
  return typeof prisma?.crmClause?.create === 'function';
}

export function hasCrmCommercialTemplateModel(prisma) {
  return typeof prisma?.crmCommercialTemplate?.create === 'function';
}

export function hasCrmCommercialBrandingModel(prisma) {
  return typeof prisma?.crmCommercialBranding?.create === 'function';
}

export function hasCrmCommercialRenderJobModel(prisma) {
  return typeof prisma?.crmCommercialRenderJob?.create === 'function';
}

export function hasCrmCommercialArtifactModel(prisma) {
  return typeof prisma?.crmCommercialArtifact?.create === 'function';
}

export function hasCrmCommercialChecksumModel(prisma) {
  return typeof prisma?.crmCommercialChecksum?.create === 'function';
}

export function hasCrmCommercialRecipientModel(prisma) {
  return typeof prisma?.crmCommercialRecipient?.create === 'function';
}

export function hasCrmCommercialDeliveryModel(prisma) {
  return typeof prisma?.crmCommercialDelivery?.create === 'function';
}

export function hasCrmCommercialReviewAccessModel(prisma) {
  return typeof prisma?.crmCommercialReviewAccess?.create === 'function';
}

export function hasCrmCommercialReviewSessionModel(prisma) {
  return typeof prisma?.crmCommercialReviewSession?.create === 'function';
}

export function hasCrmCommercialCustomerViewModel(prisma) {
  return typeof prisma?.crmCommercialCustomerView?.create === 'function';
}

export function hasCrmCommercialCustomerCommentModel(prisma) {
  return typeof prisma?.crmCommercialCustomerComment?.create === 'function';
}

export function hasCrmCommercialRevisionRequestModel(prisma) {
  return typeof prisma?.crmCommercialRevisionRequest?.create === 'function';
}

export function hasCrmCommercialAcceptanceModel(prisma) {
  return typeof prisma?.crmCommercialAcceptance?.create === 'function';
}

/**
 * Phase 20 — authorityStatus must be a real persisted column (Prisma + SQL fallback).
 * Guards accept/create paths from treating role-only rows as VERIFIED.
 */
export function hasCrmCommercialAcceptanceAuthorityStatusField(prisma) {
  if (!hasCrmCommercialAcceptanceModel(prisma)) return false;
  const delegate = prisma?.crmCommercialAcceptance;
  // Explicit opt-in used by tests / thin stubs
  if (delegate?.supportsAuthorityStatus === true) return true;
  if (delegate?.supportsAuthorityStatus === false) return false;
  // Prisma runtime data model (generated client)
  const models =
    prisma?._runtimeDataModel?.models ||
    prisma?._engineConfig?.inlineSchema ||
    null;
  if (models && typeof models === 'object' && !Array.isArray(models)) {
    const model =
      models.CrmCommercialAcceptance ||
      models.crmCommercialAcceptance ||
      null;
    const fields = model?.fields;
    if (Array.isArray(fields)) {
      return fields.some((f) => f?.name === 'authorityStatus');
    }
  }
  // Schema present in workspace: treat as supported when create exists
  // (SQL fallback scripts/sql/crm-commercial-phase20-wave1.sql).
  return true;
}

/** Normalize persisted authorityStatus; missing/blank → UNKNOWN (never role-implied VERIFIED). */
export function normalizeAcceptanceAuthorityStatus(value) {
  const raw = String(value || '')
    .trim()
    .toUpperCase();
  if (raw === 'VERIFIED' || raw === 'VERIFICATION_REQUIRED' || raw === 'UNKNOWN') {
    return raw;
  }
  return 'UNKNOWN';
}

/**
 * Build create/update data for CrmCommercialAcceptance with required authorityStatus.
 * Callers must not omit authorityStatus when the column is available.
 */
export function buildCommercialAcceptanceWriteData(data = {}) {
  const authorityStatus = normalizeAcceptanceAuthorityStatus(
    data.authorityStatus != null ? data.authorityStatus : 'UNKNOWN'
  );
  return {
    ...data,
    authorityStatus,
  };
}

export function serializeCommercialAcceptance(row) {
  if (!row) return null;
  return {
    id: row.id,
    documentVersionId: row.documentVersionId,
    artifactId: row.artifactId,
    checksumSha256: row.checksumSha256,
    recipientId: row.recipientId,
    authorityRole: row.authorityRole || null,
    authorityStatus: normalizeAcceptanceAuthorityStatus(row.authorityStatus),
    acceptedAt: row.acceptedAt ? new Date(row.acceptedAt).toISOString() : null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function hasCrmCommercialRejectionModel(prisma) {
  return typeof prisma?.crmCommercialRejection?.create === 'function';
}

export function hasCrmCommercialExpiryModel(prisma) {
  return typeof prisma?.crmCommercialExpiry?.create === 'function';
}

export function hasCrmCommercialSignatureRequestModel(prisma) {
  return typeof prisma?.crmCommercialSignatureRequest?.create === 'function';
}

export function resolveCommercialActor(args = {}) {
  return args.admin || args.actorContext?.admin || args.actorContext || null;
}

export function serializeProposalRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    requestNumber: row.requestNumber,
    status: row.status || CRM_PROPOSAL_REQUEST_STATUS.NEW,
    source: row.source || null,
    sourceRef: row.sourceRef || null,
    opportunityId: row.opportunityId || null,
    accountId: row.accountId || null,
    contactId: row.contactId || null,
    demoId: row.demoId || null,
    leadId: row.leadId || null,
    requestedDocumentType: row.requestedDocumentType || null,
    currency: row.currency || null,
    title: row.title || null,
    notes: row.notes || null,
    ownerAdminId: row.ownerAdminId || null,
    createdByAdminId: row.createdByAdminId || null,
    convertedProposalDocumentId: row.convertedProposalDocumentId || null,
    convertedQuotationDocumentId: row.convertedQuotationDocumentId || null,
    convertIdempotencyKey: row.convertIdempotencyKey || null,
    rejectedReason: row.rejectedReason || null,
    qualifiedAt: row.qualifiedAt ? new Date(row.qualifiedAt).toISOString() : null,
    convertedAt: row.convertedAt ? new Date(row.convertedAt).toISOString() : null,
    rejectedAt: row.rejectedAt ? new Date(row.rejectedAt).toISOString() : null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeCommercialDocument(row) {
  if (!row) return null;
  return {
    id: row.id,
    documentNumber: row.documentNumber,
    documentFamily: row.documentFamily,
    requestId: row.requestId || null,
    opportunityId: row.opportunityId || null,
    accountId: row.accountId || null,
    contactId: row.contactId || null,
    demoId: row.demoId || null,
    leadId: row.leadId || null,
    title: row.title || null,
    currency: row.currency || null,
    ownerAdminId: row.ownerAdminId || null,
    createdByAdminId: row.createdByAdminId || null,
    currentVersionId: row.currentVersionId || null,
    latestVersionNumber: row.latestVersionNumber ?? null,
    convertIdempotencyKey: row.convertIdempotencyKey || null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeDocumentVersion(row) {
  if (!row) return null;
  const status = row.status || CRM_COMMERCIAL_DOCUMENT_STATUS.DRAFT;
  return {
    id: row.id,
    documentId: row.documentId,
    versionNumber: row.versionNumber,
    versionLabel: row.versionLabel,
    status,
    contentJson: row.contentJson ?? null,
    revisionReason: row.revisionReason || null,
    immutable: row.immutable === true || isIssuedOrBeyond(status),
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeProposal(row) {
  if (!row) return null;
  return {
    id: row.id,
    documentId: row.documentId,
    title: row.title || null,
    narrativeJson: row.narrativeJson ?? null,
    scopesJson: row.scopesJson ?? null,
    assumptionsJson: row.assumptionsJson ?? null,
    exclusionsJson: row.exclusionsJson ?? null,
    responsibilitiesJson: row.responsibilitiesJson ?? null,
    milestonesJson: row.milestonesJson ?? null,
    pinnedQuotationVersionIds: row.pinnedQuotationVersionIds ?? null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeQuotation(row) {
  if (!row) return null;
  return {
    id: row.id,
    documentId: row.documentId,
    currency: row.currency || null,
    lineItemsJson: row.lineItemsJson ?? null,
    pricingSnapshotJson: row.pricingSnapshotJson ?? null,
    totalsJson: row.totalsJson ?? null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeDocumentWithExtension(document, version, extension, family) {
  const base = {
    document: serializeCommercialDocument(document),
    version: serializeDocumentVersion(version),
    domain: getCommercialDomainContract(),
  };
  if (family === CRM_COMMERCIAL_DOCUMENT_FAMILY.PROPOSAL) {
    return { ...base, proposal: serializeProposal(extension) };
  }
  if (family === CRM_COMMERCIAL_DOCUMENT_FAMILY.QUOTATION) {
    return { ...base, quotation: serializeQuotation(extension) };
  }
  return base;
}

export function serializePriceBook(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookNumber: row.bookNumber,
    name: row.name || null,
    bookType: row.bookType || null,
    currency: row.currency || null,
    status: row.status || null,
    currentVersionId: row.currentVersionId || null,
    latestVersionNumber: row.latestVersionNumber ?? null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializePriceBookVersion(row) {
  if (!row) return null;
  return {
    id: row.id,
    priceBookId: row.priceBookId,
    versionNumber: row.versionNumber,
    status: row.status,
    immutable: row.immutable === true || String(row.status).toUpperCase() === 'ACTIVE',
    approvedByAdminId: row.approvedByAdminId || null,
    activatedAt: row.activatedAt ? new Date(row.activatedAt).toISOString() : null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializePriceBookEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    priceBookVersionId: row.priceBookVersionId,
    productRef: row.productRef,
    unit: row.unit || null,
    listPrice: row.listPrice != null ? Number(row.listPrice) : null,
    minPrice: row.minPrice != null ? Number(row.minPrice) : null,
    currency: row.currency || null,
    billingFrequency: row.billingFrequency || null,
    taxCategory: row.taxCategory || null,
  };
}

export function serializeDiscountRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    documentVersionId: row.documentVersionId,
    percent: row.percent != null ? Number(row.percent) : null,
    status: row.status,
    requiresApproval: row.requiresApproval === true,
    reason: row.reason || null,
    requestedByAdminId: row.requestedByAdminId || null,
    approvedByAdminId: row.approvedByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

export function serializeApprovalRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    documentVersionId: row.documentVersionId,
    approvalPolicyId: row.approvalPolicyId,
    status: row.status,
    requestedByAdminId: row.requestedByAdminId || null,
    idempotencyKey: row.idempotencyKey || null,
    invalidatedReason: row.invalidatedReason || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeApprovalStep(row) {
  if (!row) return null;
  return {
    id: row.id,
    approvalRequestId: row.approvalRequestId,
    stepOrder: row.stepOrder,
    status: row.status,
    protected: row.protected === true,
    role: row.role || null,
  };
}
