/**
 * Opportunities public surface — Phase 12 Wave 1–4.
 */

export {
  allocateOpportunityNumber,
  CRM_OPPORTUNITY_NUMBER_RE,
  CRM_NUMBER_PREFIX,
} from './numbering.js';

export { createOpportunityFromHandoff } from './create.js';

export { getOpportunity } from './get.js';

export { listOpportunities } from './list.js';

export {
  BOARD_COLUMN_PAGE_SIZE,
  getPipelineBoard,
} from './board.js';

export {
  CRM_OPPORTUNITY_RISK_SEVERITY,
  CRM_OPPORTUNITY_RISK_STATUS,
  CRM_OPPORTUNITY_RISK_CODE,
  hasCrmOpportunityRiskModel,
  computeOpportunityRiskSignals,
  evaluateOpportunityRisks,
  listOpportunityRisks,
} from './risks.js';

export {
  createOpportunityTask,
  listOpportunityTasks,
  completeOpportunityTask,
} from './tasks.js';

export {
  appendOpportunityTimelineEvent,
  listOpportunityTimeline,
} from './timeline.js';

export {
  CRM_CLOSE_APPROVAL_STATUS,
  CRM_WIN_REASON,
  CRM_LOSS_REASON,
  assertNoProvision,
  resolveClosedWonAcceptanceId,
  commercialReadinessRequiredByPolicy,
  closeOpportunityWon,
  closeOpportunityLost,
  reopenOpportunity,
} from './close.js';

export {
  evaluateProposalReadiness,
  assertNoProposalCreate,
  PROPOSAL_HANDOFF_TYPE,
  PROPOSAL_HANDOFF_VERSION,
} from './proposalReadiness.js';

export {
  evaluateConversionReadiness,
  assertNoConversionExecute,
  CONVERSION_HANDOFF_TYPE,
  CONVERSION_HANDOFF_VERSION,
} from './conversionReadiness.js';

export {
  CRM_OPP_DUPLICATE_MATCH_TYPE,
  CRM_OPP_DUPLICATE_MATCH_TYPES,
  hasCrmOpportunityDuplicateCandidateModel,
  detectOpportunityDuplicateCandidates,
  listOpportunityDuplicateCandidates,
  reviewOpportunityDuplicateCandidate,
} from './duplicates.js';

export {
  CRM_OPP_IMPORT_VERSION,
  validateOpportunityImportRow,
  previewOpportunityImport,
  confirmOpportunityImport,
} from './import.js';

export {
  CRM_PIPELINE_REPORT_VERSION,
  getPipelineReport,
} from './reports.js';

export {
  CRM_PIPELINE_REPORT_SCHEDULE_STATUS,
  hasCrmPipelineReportScheduleModel,
  hasCrmPipelineReportRunModel,
  createPipelineReportSchedule,
  listPipelineReportSchedules,
  runPipelineReportSchedule,
} from './reportSchedules.js';

export {
  CRM_OPPORTUNITY_CONTACT_ROLE,
  CRM_OPPORTUNITY_CONTACT_ROLES,
  hasCrmOpportunityContactRoleModel,
  hasCrmOpportunityContactRoleHistoryModel,
  hasPrimaryContactRole,
  seedPrimaryContactFromOpportunity,
  listOpportunityContactRoles,
  upsertOpportunityContactRole,
  listOpportunityContactRoleHistory,
} from './contacts.js';

export {
  OPPORTUNITY_PRODUCT_BINDING,
  hasCrmOpportunityProductModel,
  resolveCatalogueProductRef,
  listOpportunityProducts,
  addOpportunityProduct,
} from './products.js';

export {
  WEIGHTED_PIPELINE_UI_ENABLED,
  resolveWeightedPipelineUiAccess,
  CRM_AMOUNT_BASIS,
  CRM_AMOUNT_BASES,
  hasCrmOpportunityAmountHistoryModel,
  isIso4217Currency,
  computeIndicativeWeightedAmount,
  summarizeAmountsByCurrency,
  setOpportunityCommercial,
  getOpportunityCommercial,
} from './commercial.js';

export {
  CRM_PROBABILITY_SOURCE,
  CRM_PROBABILITY_CONFIDENCE,
  CRM_PROBABILITY_CONFIDENCES,
  CRM_PROBABILITY_APPROVAL_STATUS,
  hasCrmOpportunityProbabilityHistoryModel,
  getStageDefaultProbability,
  applyStageDefaultProbability,
  overrideOpportunityProbability,
  getOpportunityProbability,
} from './probability.js';

export {
  CRM_CLOSE_DATE_SOURCE,
  CRM_CLOSE_DATE_SOURCES,
  CRM_CLOSE_DATE_CONFIDENCE,
  CRM_CLOSE_DATE_CONFIDENCES,
  hasCrmOpportunityCloseDateHistoryModel,
  isCloseDateForecastEligible,
  setOpportunityCloseDate,
  getOpportunityCloseDate,
} from './closeDate.js';
