/**
 * Marketing catalogue — Phase 23 Wave 1 foundation.
 *
 * Marketing Campaign ≠ Affiliate campaign (affiliate commissions / payouts live elsewhere).
 * Lead source SoT remains CRM CrmLead.source / CrmCaptureRecord — never duplicate here.
 *
 * Wave 1 KPI metrics (impressions, clicks, spend, CAC, ROAS, etc.) are UNAVAILABLE —
 * never return numeric zeros as placeholders.
 */

export const MARKETING_DEFINITION_VERSION = 'phase23-wave1-v1';

export const MARKETING_NUMBER_PREFIX = Object.freeze({
  CAMPAIGN: 'MKT',
});

export const MARKETING_CAMPAIGN_NUMBER_RE = /^MKT-\d{4}-\d{6}$/;

export const MARKETING_LIST_DEFAULT_LIMIT = 50;
export const MARKETING_LIST_MAX_LIMIT = 200;

/** Governed campaign lifecycle statuses. */
export const MARKETING_CAMPAIGN_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
});

export const MARKETING_CAMPAIGN_STATUSES = Object.freeze(
  Object.values(MARKETING_CAMPAIGN_STATUS)
);

/** Campaign objective / type taxonomy. */
export const MARKETING_CAMPAIGN_TYPE = Object.freeze({
  LEAD_GENERATION: 'LEAD_GENERATION',
  BRAND: 'BRAND',
  RETENTION: 'RETENTION',
  PARTNER: 'PARTNER',
  OTHER: 'OTHER',
});

export const MARKETING_CAMPAIGN_TYPES = Object.freeze(
  Object.values(MARKETING_CAMPAIGN_TYPE)
);

/** Channel / Source / Medium taxonomy row statuses. */
export const MARKETING_TAXONOMY_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
});

export const MARKETING_TAXONOMY_STATUSES = Object.freeze(
  Object.values(MARKETING_TAXONOMY_STATUS)
);

/** Versioned normalisation rule statuses (ACTIVE rows are immutable). */
export const MARKETING_NORMALISATION_RULE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  SUPERSEDED: 'SUPERSEDED',
  RETIRED: 'RETIRED',
});

export const MARKETING_NORMALISATION_RULE_STATUSES = Object.freeze(
  Object.values(MARKETING_NORMALISATION_RULE_STATUS)
);

/** Seed channel codes (governed taxonomy). */
export const MARKETING_SEED_CHANNELS = Object.freeze([
  { code: 'ORGANIC', name: 'Organic', sortOrder: 10 },
  { code: 'PAID_SEARCH', name: 'Paid Search', sortOrder: 20 },
  { code: 'PAID_SOCIAL', name: 'Paid Social', sortOrder: 30 },
  { code: 'EMAIL', name: 'Email', sortOrder: 40 },
  { code: 'REFERRAL', name: 'Referral', sortOrder: 50 },
  { code: 'PARTNER', name: 'Partner', sortOrder: 60 },
  { code: 'DIRECT', name: 'Direct', sortOrder: 70 },
  { code: 'OTHER', name: 'Other', sortOrder: 999 },
]);

/** Seed source codes (governed taxonomy). */
export const MARKETING_SEED_SOURCES = Object.freeze([
  { code: 'GOOGLE', name: 'Google', sortOrder: 10 },
  { code: 'META', name: 'Meta', sortOrder: 20 },
  { code: 'LINKEDIN', name: 'LinkedIn', sortOrder: 30 },
  { code: 'NEWSLETTER', name: 'Newsletter', sortOrder: 40 },
  { code: 'WEBSITE', name: 'Website', sortOrder: 50 },
  { code: 'PARTNER_REFERRAL', name: 'Partner Referral', sortOrder: 60 },
  { code: 'UNKNOWN', name: 'Unknown', sortOrder: 900 },
  { code: 'OTHER', name: 'Other', sortOrder: 999 },
]);

/** Seed medium codes (governed taxonomy). */
export const MARKETING_SEED_MEDIUMS = Object.freeze([
  { code: 'CPC', name: 'CPC', sortOrder: 10 },
  { code: 'CPM', name: 'CPM', sortOrder: 20 },
  { code: 'ORGANIC', name: 'Organic', sortOrder: 30 },
  { code: 'EMAIL', name: 'Email', sortOrder: 40 },
  { code: 'SOCIAL', name: 'Social', sortOrder: 50 },
  { code: 'REFERRAL', name: 'Referral', sortOrder: 60 },
  { code: 'NONE', name: 'None', sortOrder: 900 },
  { code: 'OTHER', name: 'Other', sortOrder: 999 },
]);

/**
 * Wave 1 performance metrics — MUST return UNAVAILABLE (never zero placeholders).
 * Attribution / spend / session planes land in later waves.
 */
export const MARKETING_WAVE1_UNAVAILABLE_METRICS = Object.freeze([
  'impressions',
  'clicks',
  'sessions',
  'spend',
  'cpl',
  'cac',
  'roas',
  'attributed_leads',
  'attributed_revenue',
]);

export const MARKETING_WAVE1_UNAVAILABLE_REASON = 'not_implemented_until_later_wave';

export const MARKETING_READINESS = Object.freeze({
  WAVE1_FOUNDATION: 'WAVE1_FOUNDATION',
});

/** Allowed campaign status transitions (simple allowlist — no skip jumps). */
export const MARKETING_CAMPAIGN_STATUS_TRANSITIONS = Object.freeze({
  [MARKETING_CAMPAIGN_STATUS.DRAFT]: [
    MARKETING_CAMPAIGN_STATUS.ACTIVE,
    MARKETING_CAMPAIGN_STATUS.ARCHIVED,
  ],
  [MARKETING_CAMPAIGN_STATUS.ACTIVE]: [
    MARKETING_CAMPAIGN_STATUS.PAUSED,
    MARKETING_CAMPAIGN_STATUS.COMPLETED,
    MARKETING_CAMPAIGN_STATUS.ARCHIVED,
  ],
  [MARKETING_CAMPAIGN_STATUS.PAUSED]: [
    MARKETING_CAMPAIGN_STATUS.ACTIVE,
    MARKETING_CAMPAIGN_STATUS.COMPLETED,
    MARKETING_CAMPAIGN_STATUS.ARCHIVED,
  ],
  [MARKETING_CAMPAIGN_STATUS.COMPLETED]: [MARKETING_CAMPAIGN_STATUS.ARCHIVED],
  [MARKETING_CAMPAIGN_STATUS.ARCHIVED]: [],
});

/**
 * @param {string} from
 * @param {string} to
 */
export function canTransitionCampaignStatus(from, to) {
  const allowed = MARKETING_CAMPAIGN_STATUS_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}
