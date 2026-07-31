/**
 * Product Analytics catalogue — metric codes + readiness constants (Phase 9 Wave 1).
 */

import {
  INSTRUMENTED_FEATURE_CODES,
  PRODUCT_FEATURE_CODES,
  FEATURE_EVENT_CODES,
} from '@/lib/admin/productCatalogue/features.js';

export const PRODUCT_ANALYTICS_CATALOGUE_VERSION = 'product-analytics-2026-07-29';

export const PRODUCT_RELIABILITY_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  NOT_INSTRUMENTED: 'NOT_INSTRUMENTED',
  DEFINITION_MISSING: 'DEFINITION_MISSING',
  STALE: 'STALE',
  DELAYED: 'DELAYED',
  RECONCILIATION_FAILED: 'RECONCILIATION_FAILED',
  DATA_QUALITY_BLOCKED: 'DATA_QUALITY_BLOCKED',
  LOW_SAMPLE: 'LOW_SAMPLE',
  PERMISSION_RESTRICTED: 'PERMISSION_RESTRICTED',
  UNSUPPORTED_PERIOD: 'UNSUPPORTED_PERIOD',
});

export const PRODUCT_METRIC_CODES = Object.freeze({
  INVOICES_POST_COUNT: 'product.feature.invoices.post.count',
  POS_COMPLETE_COUNT: 'product.feature.sales.pos.complete.count',
  EIS_ACCEPT_COUNT: 'product.feature.eis.fiscal.accept.count',
});

/** Map metric code → feature code for gate evaluation. */
export const METRIC_FEATURE_MAP = Object.freeze({
  [PRODUCT_METRIC_CODES.INVOICES_POST_COUNT]: PRODUCT_FEATURE_CODES.INVOICES_POST,
  [PRODUCT_METRIC_CODES.POS_COMPLETE_COUNT]: PRODUCT_FEATURE_CODES.SALES_POS_COMPLETE,
  [PRODUCT_METRIC_CODES.EIS_ACCEPT_COUNT]: PRODUCT_FEATURE_CODES.EIS_FISCAL_ACCEPT,
});

export {
  INSTRUMENTED_FEATURE_CODES,
  PRODUCT_FEATURE_CODES,
  FEATURE_EVENT_CODES,
};

export const PRODUCT_ANALYTICS_NOTES = Object.freeze([
  'Strict events only — domain tables are candidates until producers emit.',
  'Page views / login alone ≠ value / activation / adoption.',
  'FEATURE_USED remains scaffold-only; commerce uses typed event codes.',
  'Retries / reprints / rejects must not count as new MRA accepted value.',
]);
