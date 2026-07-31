/**
 * Customer Intelligence domain barrel (Phase 7 Wave 1).
 */

export {
  CUSTOMER_CATALOGUE_VERSION,
  CUSTOMER_READINESS,
  CUSTOMER_SECTION_CODES,
  CUSTOMER_METRIC_CODES,
  LIFECYCLE_STAGES,
  LIFECYCLE_RULE_VERSION,
} from './catalogue.js';

export { resolveLifecycleStage, pickPrimarySubscription } from './lifecycle.js';
export { loadHierarchyCounts, buildHierarchySection } from './hierarchy.js';
export {
  ENGAGEMENT_LIMITATIONS,
  loadEngagementProxy,
  buildEngagementSection,
} from './engagement.js';
export { loadTenantCommercial, buildCommercialSection } from './commercial.js';
export { loadMraEisSummary, buildMraEisSection } from './mraEis.js';
export { buildCustomer360 } from './customer360.js';
export { listCustomerDirectory } from './directory.js';
export { buildCustomerOverviewPack } from './overviewPack.js';
export { resolveCustomerAccess } from './authz.js';
export {
  assertTenantInPortfolio,
  resolvePortfolioScope,
  applyPortfolioTenantWhere,
  listOwnedTenantIds,
  activeOwnershipWhere,
} from './portfolioScope.js';
export {
  listPortfolios,
  createPortfolio,
  listPortfolioMembers,
  assignOwnership,
  listUnassignedCustomers,
  loadTenantOwnership,
  PORTFOLIO_TYPE,
  PORTFOLIO_STATUS,
  ASSIGNMENT_TYPE,
} from './portfolios.js';
export {
  SYSTEM_SEGMENT_CODES,
  listSystemSegmentDefinitions,
  listUnassignedTenantIds,
  listRenewalsDueTenantIds,
} from './segments.js';

export {
  CUSTOMER_SIGNAL_RULE_VERSION,
  SIGNAL_CODES,
  SIGNAL_SEVERITY,
  SIGNAL_STATUS,
  SIGNAL_KIND,
  SIGNAL_CATALOGUE,
  SIGNAL_NOT_SUPPORTED,
  SIGNAL_NOT_INSTRUMENTED,
} from './signalCatalogue.js';

export {
  evaluateTenantSignals,
  evaluateAttentionQueue,
  updateCustomerSignalState,
  buildSignalsSection,
  deriveCandidateSignals,
  serializeSignal,
} from './signals.js';

export { buildCustomerReconciliation } from './reconciliation.js';

export {
  buildCustomerExportPack,
  formatCustomerExportCsv,
} from './export.js';
