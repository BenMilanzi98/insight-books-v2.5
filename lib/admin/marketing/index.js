/**
 * Marketing admin package — Phase 23 Wave 1 public API.
 */

export {
  MARKETING_DEFINITION_VERSION,
  MARKETING_NUMBER_PREFIX,
  MARKETING_CAMPAIGN_NUMBER_RE,
  MARKETING_CAMPAIGN_STATUS,
  MARKETING_CAMPAIGN_STATUSES,
  MARKETING_CAMPAIGN_TYPE,
  MARKETING_CAMPAIGN_TYPES,
  MARKETING_TAXONOMY_STATUS,
  MARKETING_TAXONOMY_STATUSES,
  MARKETING_NORMALISATION_RULE_STATUS,
  MARKETING_NORMALISATION_RULE_STATUSES,
  MARKETING_SEED_CHANNELS,
  MARKETING_SEED_SOURCES,
  MARKETING_SEED_MEDIUMS,
  MARKETING_WAVE1_UNAVAILABLE_METRICS,
  MARKETING_WAVE1_UNAVAILABLE_REASON,
  MARKETING_READINESS,
  MARKETING_CAMPAIGN_STATUS_TRANSITIONS,
  canTransitionCampaignStatus,
} from './catalogue.js';

export {
  formatMarketingNumber,
  utcYearOf,
  allocateMarketingNumber,
} from './numbering.js';

export { resolveMarketingAccess } from './authz.js';

export { isSafeMarketingUrl, normalizeMarketingUrl } from './urlSafety.js';

export {
  UTM_KEYS,
  UTM_MAX_LENGTHS,
  parseUtmFromUrl,
  parseUtmFromSearchParams,
  buildUtmQuery,
  validateUtmParams,
} from './utm.js';

export {
  listChannels,
  listSources,
  listMediums,
  createChannel,
  createSource,
  createMedium,
  ensureSeedTaxonomy,
  listNormalisationRules,
  createNormalisationRule,
  activateNormalisationRule,
} from './taxonomy.js';

export {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  transitionCampaignStatus,
} from './campaigns.js';

export { getMarketingOverview } from './overview.js';

export { getLeadSourceEvidence } from './leadSourceEvidence.js';
