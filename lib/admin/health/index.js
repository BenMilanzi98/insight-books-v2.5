/**
 * Customer Health domain barrel (Phase 8 Wave 1).
 */

export {
  HEALTH_DEFINITION_VERSION,
  MISSING_POLICY,
  DIMENSION_STATUS,
  DIMENSION_CODES,
  V1_BASE_WEIGHTS,
  V1_NA_DIMENSIONS,
  HEALTH_BANDS,
  BAND_RANGES,
  HEALTH_CONFIDENCE,
  MIN_SCORED_DIMENSIONS,
  OVERRIDE_CODES,
  HEALTH_CATALOGUE_NOTES,
} from './catalogue.js';

export {
  builtInHealthDefinition,
  getActiveHealthDefinition,
  bandForScore,
} from './definitions.js';

export {
  resolveHealthAccess,
  assertHealthTenantAccess,
  resolveHealthPortfolioScope,
  healthTenantIdFilter,
  resolvePortfolioScope,
} from './authz.js';

export {
  applyMissingPolicy,
  computeWeightedScore,
  evaluateCustomerHealth,
} from './evaluate.js';

export { resolveHealthConfidence } from './confidence.js';
export { applyHealthOverrides } from './overrides.js';

export {
  persistHealthSnapshot,
  rebuildHealthSnapshot,
  listHealthSnapshots,
  getLatestHealthSnapshot,
} from './snapshots.js';

export { buildHealthReconciliation } from './reconcile.js';

export {
  buildHealthOverviewPack,
  buildHealthExportPack,
  formatHealthExportCsv,
} from './pack.js';

export {
  evaluateAllDimensions,
  scoreCommercialDimension,
  scoreEngagementDimension,
  scoreMraEisDimension,
  scoreRelationshipDimension,
  notApplicableDimension,
} from './dimensions/index.js';
