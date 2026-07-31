/**

 * CRM Commercial Documents — Phase 15 Wave 1–3 public surface.

 * Wave 1: Proposal Request + CrmCommercialDocument spine.

 * Wave 2: Price Books, pricing, tax/FX, discounts, approvals.

 * Wave 3: Templates, PDF, issue, delivery, review, acceptance.

 * Wave 4: Hubs, reports/DQ/recon, Closed-Won readiness, Phase 16 handoff.

 * Tenant Quotation = WRONG_DOMAIN. No Opp auto-mutation. E-sign NOT_CONFIGURED.

 */



export {

  CRM_PROPOSAL_REQUEST_STATUS,

  CRM_PROPOSAL_REQUEST_STATUSES,

  CRM_PROPOSAL_REQUEST_TRANSITION_TABLE,

  CRM_COMMERCIAL_DOCUMENT_STATUS,

  CRM_COMMERCIAL_DOCUMENT_STATUSES,

  CRM_COMMERCIAL_DOCUMENT_TRANSITION_TABLE,

  CRM_COMMERCIAL_DOCUMENT_FAMILY,

  CRM_COMMERCIAL_DOCUMENT_FAMILIES,

  CRM_REQUESTED_DOCUMENT_TYPE,

  CRM_PROPOSAL_REQUEST_SOURCE,

  CRM_PRICE_BOOK_TYPE,

  CRM_PRICE_BOOK_VERSION_STATUS,

  CRM_FX_RELIABILITY,

  CRM_DISCOUNT_REQUEST_STATUS,

  CRM_APPROVAL_REQUEST_STATUS,

  CRM_APPROVAL_STEP_STATUS,

  CRM_DEFAULT_SALESPERSON_DISCOUNT_MAX_PERCENT,

  isValidCommercialDocumentStatus,

  isValidProposalRequestStatus,

  canTransitionCommercialDocumentStatus,

  canTransitionProposalRequestStatus,

  isIssuedOrBeyond,

  getCommercialDomainContract,

} from './catalogue.js';



export {

  allocateProposalRequestNumber,

  allocateProposalNumber,

  allocateQuotationNumber,

  allocatePriceBookNumber,

  formatDocumentVersionLabel,

  CRM_PROPOSAL_REQUEST_NUMBER_RE,

  CRM_PROPOSAL_NUMBER_RE,

  CRM_QUOTATION_NUMBER_RE,

  CRM_PRICE_BOOK_NUMBER_RE,

} from './numbering.js';



export {

  hasCrmProposalRequestModel,

  hasCrmProposalRequestStatusHistoryModel,

  hasCrmCommercialDocumentModel,

  hasCrmCommercialDocumentVersionModel,

  hasCrmCommercialDocumentVersionStatusHistoryModel,

  hasCrmProposalModel,

  hasCrmQuotationModel,

  hasCrmPriceBookModel,

  hasCrmPriceBookVersionModel,

  hasCrmPriceBookEntryModel,

  hasCrmTaxRuleModel,

  hasCrmTaxRateVersionModel,

  hasCrmDiscountPolicyModel,

  hasCrmDiscountRequestModel,

  hasCrmPricingExceptionModel,

  hasCrmPricingSnapshotModel,

  hasCrmApprovalPolicyModel,

  hasCrmApprovalRequestModel,

  hasCrmApprovalStepModel,

  hasCrmApprovalDecisionModel,

  hasCrmTermModel,

  hasCrmClauseModel,

  hasCrmCommercialTemplateModel,

  hasCrmCommercialBrandingModel,

  hasCrmCommercialRenderJobModel,

  hasCrmCommercialArtifactModel,

  hasCrmCommercialChecksumModel,

  hasCrmCommercialRecipientModel,

  hasCrmCommercialDeliveryModel,

  hasCrmCommercialReviewAccessModel,

  hasCrmCommercialReviewSessionModel,

  hasCrmCommercialCustomerViewModel,

  hasCrmCommercialCustomerCommentModel,

  hasCrmCommercialRevisionRequestModel,

  hasCrmCommercialAcceptanceModel,

  hasCrmCommercialAcceptanceAuthorityStatusField,

  buildCommercialAcceptanceWriteData,

  normalizeAcceptanceAuthorityStatus,

  serializeCommercialAcceptance,

  hasCrmCommercialRejectionModel,

  hasCrmCommercialExpiryModel,

  hasCrmCommercialSignatureRequestModel,

  resolveCommercialActor,

  serializeProposalRequest,

  serializeCommercialDocument,

  serializeDocumentVersion,

  serializeProposal,

  serializeQuotation,

  serializePriceBook,

  serializePriceBookVersion,

  serializePriceBookEntry,

  serializeDiscountRequest,

  serializeApprovalRequest,

  serializeApprovalStep,

} from './model.js';



export {

  createProposalRequest,

  createProposalRequestFromDemoHandoff,

  seedProposalRequestFromOpportunityReadiness,

  qualifyProposalRequest,

  rejectProposalRequest,

  convertProposalRequest,

  listProposalRequests,

} from './requests.js';



export {

  createCommercialDocument,

  getCommercialDocument,

  listCommercialDocuments,

  loadCommercialDocument,

} from './documents.js';



export { createProposal, getProposal } from './proposals.js';



export { createQuotation, getQuotation } from './quotations.js';



export {

  createDocumentVersion,

  updateDocumentVersionContent,

  assertVersionMutable,

  loadDocumentVersion,

} from './versions.js';



export {

  transitionDocumentStatus,

  transitionProposalRequestStatus,

} from './status.js';



export {

  createPriceBook,

  approvePriceBookVersion,

  activatePriceBookVersion,

  updatePriceBookEntry,

  listPriceBooks,

} from './priceBooks.js';



export {

  normalizeProductRef,

  normalizeBillingFrequency,

  findPriceBookEntryForProduct,

  assertNotOpportunityEstimateAsPriceBook,

} from './productConfig.js';



export {

  normalizeLineItem,

  normalizeLineItems,

  collectLineCurrencies,

} from './lineItems.js';



export {

  resolveFxContext,

  assertCurrencyPricingGate,

  convertAmount,

  roundMoney,

} from './currencyFx.js';



export { resolveTaxContext, computeTaxTotal } from './tax.js';



export {

  createDiscountRequest,

  approveDiscountRequest,

  resolveDiscountApplication,

} from './discounts.js';



export {

  createPricingException,

  approvePricingException,

  filterApprovedExceptions,

} from './exceptions.js';



export {

  buildCurrencyExplicitTotals,

  buildPricingSnapshotPayload,

} from './pricingSnapshot.js';



export { calculateCommercialDocument } from './pricing.js';



export { createTerm, listTerms } from './terms.js';



export { createClause, listClauses } from './clauses.js';



export {

  submitCommercialDocumentForApproval,

  decideApprovalStep,

  applyMaterialDocumentChange,

  listCommercialApprovals,

} from './approvals.js';



export {

  CRM_COMMERCIAL_PROJECTION,

  CRM_COMMERCIAL_PROJECTIONS,

  CUSTOMER_UNSAFE_CONTENT_KEYS,

  projectContentForAudience,

  buildDeterministicHtmlDocument,

  createCommercialTemplate,

  loadDefaultBranding,

} from './templates.js';



export { sha256Hex, assertChecksumMatch, CRM_CHECKSUM_ALGORITHM } from './checksum.js';



export {

  getCommercialStorageAdapter,

  createMemoryStorageAdapter,

  createFilesystemStorageAdapter,

  buildPrivateArtifactKey,

  resetCommercialStorageForTests,

} from './storage.js';



export {

  persistArtifactWithChecksum,

  loadArtifactChecksum,

  serializeArtifact,

  serializeChecksum,

} from './artifacts.js';



export { renderCommercialDocument, htmlToDeterministicPdfBuffer } from './render.js';



export {

  CRM_DELIVERY_METHOD,

  recordCommercialDelivery,

  serializeDelivery,

} from './delivery.js';



export {

  createReviewAccess,

  resolveReviewAccessByToken,

  revokeReviewAccessForVersion,

  recordCustomerView,

  generateReviewToken,

  hashReviewToken,

  serializeReviewAccess,

} from './reviewAccess.js';



export { issueCommercialDocument, withdrawCommercialDocument } from './issue.js';



export { submitCustomerComment } from './customerComments.js';



export { submitRevisionRequest } from './revisionRequests.js';



export {
  CRM_ACCEPTANCE_AUTHORITY_STATUS,
  acceptCommercialDocument,
  evaluateAcceptanceAuthority,
  evaluateAcceptanceAuthorityStatus,
  assertEngagementIsNotAcceptance,
  serializeAcceptance,
} from './acceptance.js';



export { rejectCommercialDocument, serializeRejection } from './rejection.js';



export { runCommercialExpiryJob } from './expiry.js';



export {

  getESignatureProviderStatus,

  assertESignNotFabricated,

  createSignatureRequestBoundary,

  CRM_ESIGN_STATUS,

} from './signatureBoundary.js';

export {
  evaluateClosedWonReadiness,
  hasCrmClosedWonConversionHandoffModel,
  CLOSED_WON_READINESS_VERSION,
} from './readiness.js';

export {
  createClosedWonConversionHandoff,
  serializeClosedWonHandoff,
  PHASE16_CONVERSION_HANDOFF_TYPE,
  PHASE16_CONVERSION_HANDOFF_VERSION,
} from './phase16Handoff.js';

export {
  applyCommercialReportHonesty,
  safeCommercialCount,
} from './reliabilityGate.js';

export { getCommercialMetric, CRM_COMMERCIAL_METRIC_VERSION } from './metrics.js';

export {
  getCommercialReport,
  getCommercialOverview,
  CRM_COMMERCIAL_REPORT_VERSION,
} from './reports.js';

export {
  createCommercialReportSchedule,
  listCommercialReportSchedules,
  runCommercialReportSchedule,
  hasCrmCommercialReportScheduleModel,
  hasCrmCommercialReportRunModel,
} from './reportSchedules.js';

export {
  runCommercialDataQuality,
  CRM_COMMERCIAL_DQ_VERSION,
} from './dataQuality.js';

export {
  runCommercialReconciliation,
  CRM_COMMERCIAL_RECON_VERSION,
} from './reconciliation.js';

export {
  CRM_COMMERCIAL_HUB_ROUTES,
  CRM_COMMERCIAL_PERMISSION_NOTES,
  CRM_COMMERCIAL_SEARCH_KEYS,
  CRM_COMMERCIAL_CACHE_KEYS,
} from './hubKeys.js';
