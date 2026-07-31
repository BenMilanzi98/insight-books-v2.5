/**
 * Business Setup Wizard — statuses, step catalogue, setup types.
 * Slice 1 foundation (A3/B1/C2/D2).
 */

export const SETUP_RUN_STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_FOR_INFORMATION: 'WAITING_FOR_INFORMATION',
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  UNDER_REVIEW: 'UNDER_REVIEW',
  CHANGES_REQUIRED: 'CHANGES_REQUIRED',
  APPROVED: 'APPROVED',
  POSTING: 'POSTING',
  COMPLETED: 'COMPLETED',
  COMPLETED_WITH_WARNINGS: 'COMPLETED_WITH_WARNINGS',
  POSTING_FAILED: 'POSTING_FAILED',
  REOPEN_REQUESTED: 'REOPEN_REQUESTED',
  REOPENED: 'REOPENED',
  REVERSED: 'REVERSED',
  CANCELLED: 'CANCELLED',
});

export const SETUP_STEP_STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  COMPLETED_WITH_WARNINGS: 'COMPLETED_WITH_WARNINGS',
  BLOCKED: 'BLOCKED',
  SKIPPED_OPTIONAL: 'SKIPPED_OPTIONAL',
  REQUIRES_REVIEW: 'REQUIRES_REVIEW',
  APPROVED: 'APPROVED',
  POSTED: 'POSTED',
});

export const SETUP_TYPE = Object.freeze({
  NEW_BUSINESS: 'NEW_BUSINESS',
  EXISTING_BUSINESS_CONVERSION: 'EXISTING_BUSINESS_CONVERSION',
  DATA_MIGRATION: 'DATA_MIGRATION',
  OPENING_BALANCE_ONLY: 'OPENING_BALANCE_ONLY',
  REIMPLEMENTATION_RECOVERY: 'REIMPLEMENTATION_RECOVERY',
});

export const BUSINESS_ACTIVITY_CLASS = Object.freeze({
  NEW_EMPTY_BUSINESS: 'NEW_EMPTY_BUSINESS',
  NEW_PARTIALLY_CONFIGURED_BUSINESS: 'NEW_PARTIALLY_CONFIGURED_BUSINESS',
  EXISTING_WITHOUT_FINANCIAL_ACTIVITY: 'EXISTING_WITHOUT_FINANCIAL_ACTIVITY',
  EXISTING_WITH_FINANCIAL_ACTIVITY: 'EXISTING_WITH_FINANCIAL_ACTIVITY',
  EXISTING_SETUP_COMPLETED: 'EXISTING_SETUP_COMPLETED',
  REQUIRES_CONTROLLED_CONVERSION: 'REQUIRES_CONTROLLED_CONVERSION',
  BLOCKED: 'BLOCKED',
});

/** Canonical 23-step catalogue (capability map). */
export const SETUP_STEP_DEFS = Object.freeze([
  { id: 'profile', label: 'Business profile', group: 'foundation', optional: false },
  { id: 'ownership', label: 'Legal structure & ownership', group: 'foundation', optional: false },
  { id: 'calendar', label: 'Financial calendar & opening dates', group: 'foundation', optional: false },
  { id: 'chartOfAccounts', label: 'Chart of Accounts', group: 'accounts', optional: false },
  { id: 'accountMappings', label: 'System account mappings', group: 'accounts', optional: false },
  { id: 'paymentAccounts', label: 'Payment accounts', group: 'accounts', optional: false },
  { id: 'customers', label: 'Customers', group: 'receivables', optional: true },
  { id: 'openingReceivables', label: 'Opening receivables', group: 'receivables', optional: true },
  { id: 'suppliers', label: 'Suppliers', group: 'payables', optional: true },
  { id: 'openingPayables', label: 'Opening payables', group: 'payables', optional: true },
  { id: 'inventoryItems', label: 'Inventory items', group: 'inventory', optional: true },
  { id: 'openingStock', label: 'Opening stock', group: 'inventory', optional: true },
  { id: 'fixedAssets', label: 'Fixed assets', group: 'assets', optional: true },
  { id: 'otherAssets', label: 'Other assets', group: 'assets', optional: true },
  { id: 'liabilitiesLoans', label: 'Liabilities & loans', group: 'liabilities', optional: true },
  { id: 'taxes', label: 'Taxes & statutory balances', group: 'liabilities', optional: true },
  { id: 'capitalEquity', label: 'Capital & equity', group: 'equity', optional: false },
  { id: 'manualBalances', label: 'Other opening balances', group: 'equity', optional: true },
  { id: 'trialBalance', label: 'Opening trial balance review', group: 'review', optional: false },
  { id: 'reconciliation', label: 'Subledger reconciliation', group: 'review', optional: false },
  { id: 'documents', label: 'Supporting documents', group: 'review', optional: true },
  { id: 'approval', label: 'Final review & approval', group: 'posting', optional: false },
  { id: 'posting', label: 'Posting & completion', group: 'posting', optional: false },
]);

export const SETUP_STEP_IDS = Object.freeze(SETUP_STEP_DEFS.map((s) => s.id));

/** Temporary permission mapping until granular setup.* seeds land. */
export const SETUP_PERMISSION_ALIASES = Object.freeze({
  'setup.view': 'settings.view',
  'setup.start': 'settings.view',
  'setup.businessProfile.manage': 'settings.view',
  'setup.financialCalendar.manage': 'settings.view',
  'setup.submit': 'settings.view',
  'setup.review': 'settings.view',
  'setup.approve': 'settings.view',
  'setup.post': 'settings.view',
  'setup.reopen.request': 'settings.view',
  'setup.reopen.approve': 'settings.view',
});
