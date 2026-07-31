/**
 * Repo-backed product features — Wave 1 instrumented commerce trio + module shells.
 */

import { PRODUCT_CADENCE } from './cadence.js';
import { INSTRUMENTATION_STATE, PRODUCT_LIFECYCLE } from './lifecycle.js';

export const PRODUCT_FEATURE_CODES = Object.freeze({
  INVOICES_POST: 'invoices.post',
  SALES_POS_COMPLETE: 'sales.pos.complete',
  EIS_FISCAL_ACCEPT: 'eis.fiscal.accept',
});

/** Feature codes with live producers in Wave 1. */
export const INSTRUMENTED_FEATURE_CODES = new Set([
  PRODUCT_FEATURE_CODES.INVOICES_POST,
  PRODUCT_FEATURE_CODES.SALES_POS_COMPLETE,
  PRODUCT_FEATURE_CODES.EIS_FISCAL_ACCEPT,
]);

/** Event codes bound to instrumented features. */
export const FEATURE_EVENT_CODES = Object.freeze({
  [PRODUCT_FEATURE_CODES.INVOICES_POST]: 'SALES_INVOICE_POSTED',
  [PRODUCT_FEATURE_CODES.SALES_POS_COMPLETE]: 'POS_TRANSACTION_COMPLETED',
  [PRODUCT_FEATURE_CODES.EIS_FISCAL_ACCEPT]: 'MRA_EIS_TRANSACTION_ACCEPTED',
});

/**
 * @typedef {{
 *   code: string,
 *   name: string,
 *   moduleCode: string,
 *   instrumented: boolean,
 *   instrumentation: string,
 *   eventCode: string|null,
 *   cadence: string,
 *   lifecycle: string,
 *   meaningfulAction: string|null,
 *   exclusions: string[],
 * }} FeatureDef
 */

/** @type {FeatureDef[]} */
const FEATURES = Object.freeze([
  {
    code: PRODUCT_FEATURE_CODES.INVOICES_POST,
    name: 'Post sales invoice',
    moduleCode: 'invoices',
    instrumented: true,
    instrumentation: INSTRUMENTATION_STATE.INSTRUMENTED,
    eventCode: FEATURE_EVENT_CODES[PRODUCT_FEATURE_CODES.INVOICES_POST],
    cadence: PRODUCT_CADENCE.EVENT_DRIVEN,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    meaningfulAction: 'Posted sales invoice',
    exclusions: ['drafts', 'voids without post', 'reprints'],
  },
  {
    code: PRODUCT_FEATURE_CODES.SALES_POS_COMPLETE,
    name: 'Complete POS sale',
    moduleCode: 'sales',
    instrumented: true,
    instrumentation: INSTRUMENTATION_STATE.INSTRUMENTED,
    eventCode: FEATURE_EVENT_CODES[PRODUCT_FEATURE_CODES.SALES_POS_COMPLETE],
    cadence: PRODUCT_CADENCE.DAILY,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    meaningfulAction: 'Completed POS sale',
    exclusions: ['abandoned carts', 'reprints', 'drafts'],
  },
  {
    code: PRODUCT_FEATURE_CODES.EIS_FISCAL_ACCEPT,
    name: 'Accept fiscal transmission',
    moduleCode: 'eis',
    instrumented: true,
    instrumentation: INSTRUMENTATION_STATE.INSTRUMENTED,
    eventCode: FEATURE_EVENT_CODES[PRODUCT_FEATURE_CODES.EIS_FISCAL_ACCEPT],
    cadence: PRODUCT_CADENCE.EVENT_DRIVEN,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    meaningfulAction: 'Accepted fiscal transmission',
    exclusions: ['retries', 'rejects', 'reprints'],
  },
  // Shell — catalogue-visible but not instrumented (gate → NOT_INSTRUMENTED)
  {
    code: 'payroll.run',
    name: 'Run payroll',
    moduleCode: 'payroll',
    instrumented: false,
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    eventCode: null,
    cadence: PRODUCT_CADENCE.MONTHLY,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    meaningfulAction: null,
    exclusions: [],
  },
]);

/**
 * @returns {FeatureDef[]}
 */
export function listProductFeatures() {
  return FEATURES.map((f) => ({
    ...f,
    exclusions: [...f.exclusions],
  }));
}

/**
 * @param {string} code
 * @returns {FeatureDef|null}
 */
export function getProductFeature(code) {
  const found = FEATURES.find((f) => f.code === code);
  if (!found) return null;
  return { ...found, exclusions: [...found.exclusions] };
}

/**
 * @param {string} featureCode
 */
export function isInstrumentedFeature(featureCode) {
  return INSTRUMENTED_FEATURE_CODES.has(featureCode);
}
