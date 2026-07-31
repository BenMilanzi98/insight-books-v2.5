/** Cadence defaults for product features (MODULE_FEATURE_MATRIX). */

export const PRODUCT_CADENCE = Object.freeze({
  DAILY: 'DAILY',
  EVENT_DRIVEN: 'EVENT_DRIVEN',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  AD_HOC: 'AD_HOC',
});

/** Default cadence by module code. */
export const MODULE_CADENCE_DEFAULTS = Object.freeze({
  invoices: PRODUCT_CADENCE.EVENT_DRIVEN,
  sales: PRODUCT_CADENCE.DAILY,
  eis: PRODUCT_CADENCE.EVENT_DRIVEN,
  payroll: PRODUCT_CADENCE.MONTHLY,
  reports: PRODUCT_CADENCE.MONTHLY,
  quotations: PRODUCT_CADENCE.AD_HOC,
  inventory: PRODUCT_CADENCE.DAILY,
  accounting: PRODUCT_CADENCE.MONTHLY,
});
