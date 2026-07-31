/**
 * Repo-backed product modules (MODULE_FEATURE_MATRIX.md).
 */

import { PRODUCT_AREAS } from './areas.js';
import { INSTRUMENTATION_STATE, PRODUCT_LIFECYCLE } from './lifecycle.js';
import { MODULE_CADENCE_DEFAULTS, PRODUCT_CADENCE } from './cadence.js';

/** @typedef {{ code: string, name: string, area: string, evidence: string, instrumentation: string, lifecycle: string, cadence: string }} ModuleDef */

/** @type {ModuleDef[]} */
const MODULES = Object.freeze([
  {
    code: 'invoices',
    name: 'Invoices',
    area: PRODUCT_AREAS.CUSTOMER_AND_SALES,
    evidence: 'permissionsMap, /invoice',
    instrumentation: INSTRUMENTATION_STATE.INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: MODULE_CADENCE_DEFAULTS.invoices,
  },
  {
    code: 'sales',
    name: 'POS / Sales',
    area: PRODUCT_AREAS.CUSTOMER_AND_SALES,
    evidence: 'permissionsMap, /pos',
    instrumentation: INSTRUMENTATION_STATE.INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: MODULE_CADENCE_DEFAULTS.sales,
  },
  {
    code: 'eis',
    name: 'MRA EIS',
    area: PRODUCT_AREAS.MRA_EIS,
    evidence: 'permissionsMap, /eis',
    instrumentation: INSTRUMENTATION_STATE.INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: MODULE_CADENCE_DEFAULTS.eis,
  },
  {
    code: 'quotations',
    name: 'Quotations',
    area: PRODUCT_AREAS.CUSTOMER_AND_SALES,
    evidence: 'routes',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: MODULE_CADENCE_DEFAULTS.quotations,
  },
  {
    code: 'clients',
    name: 'Clients',
    area: PRODUCT_AREAS.CUSTOMER_AND_SALES,
    evidence: 'routes',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: PRODUCT_CADENCE.AD_HOC,
  },
  {
    code: 'inventory',
    name: 'Inventory',
    area: PRODUCT_AREAS.INVENTORY_AND_COMMERCE,
    evidence: '/stock',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: MODULE_CADENCE_DEFAULTS.inventory,
  },
  {
    code: 'purchases',
    name: 'Purchases',
    area: PRODUCT_AREAS.PURCHASING_AND_EXPENSES,
    evidence: 'routes',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: PRODUCT_CADENCE.AD_HOC,
  },
  {
    code: 'expenses',
    name: 'Expenses',
    area: PRODUCT_AREAS.PURCHASING_AND_EXPENSES,
    evidence: 'routes',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: PRODUCT_CADENCE.AD_HOC,
  },
  {
    code: 'accounting',
    name: 'Accounting',
    area: PRODUCT_AREAS.ACCOUNTING_AND_FINANCE,
    evidence: 'routes',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: MODULE_CADENCE_DEFAULTS.accounting,
  },
  {
    code: 'generalLedger',
    name: 'General Ledger',
    area: PRODUCT_AREAS.ACCOUNTING_AND_FINANCE,
    evidence: 'routes',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: PRODUCT_CADENCE.MONTHLY,
  },
  {
    code: 'journalEntries',
    name: 'Journal Entries',
    area: PRODUCT_AREAS.ACCOUNTING_AND_FINANCE,
    evidence: 'routes',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: PRODUCT_CADENCE.EVENT_DRIVEN,
  },
  {
    code: 'reports',
    name: 'Reports',
    area: PRODUCT_AREAS.REPORTING_AND_INTELLIGENCE,
    evidence: '/reports-v2',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: MODULE_CADENCE_DEFAULTS.reports,
  },
  {
    code: 'payroll',
    name: 'Payroll',
    area: PRODUCT_AREAS.WORKFORCE_AND_PAYROLL,
    evidence: '/hr',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: MODULE_CADENCE_DEFAULTS.payroll,
  },
  {
    code: 'hr',
    name: 'HR',
    area: PRODUCT_AREAS.WORKFORCE_AND_PAYROLL,
    evidence: 'routes',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: PRODUCT_CADENCE.MONTHLY,
  },
  {
    code: 'budgets',
    name: 'Budgets',
    area: PRODUCT_AREAS.ACCOUNTING_AND_FINANCE,
    evidence: 'budget-forecast',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: PRODUCT_CADENCE.QUARTERLY,
  },
  {
    code: 'assets',
    name: 'Assets',
    area: PRODUCT_AREAS.ASSETS_AND_LIABILITIES,
    evidence: 'asset-management',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: PRODUCT_CADENCE.MONTHLY,
  },
  {
    code: 'rentals',
    name: 'Rentals',
    area: PRODUCT_AREAS.RENTAL_AND_HIRING,
    evidence: 'routes',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: PRODUCT_CADENCE.AD_HOC,
  },
  {
    code: 'tax',
    name: 'Tax',
    area: PRODUCT_AREAS.TAX_AND_COMPLIANCE,
    evidence: 'routes',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: PRODUCT_CADENCE.MONTHLY,
  },
  {
    code: 'bankReconciliation',
    name: 'Bank Reconciliation',
    area: PRODUCT_AREAS.BANKING_AND_CASH,
    evidence: 'permissionsMap',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: PRODUCT_CADENCE.DAILY,
  },
  {
    code: 'dashboard',
    name: 'Dashboard',
    area: PRODUCT_AREAS.CORE_PLATFORM,
    evidence: 'routes',
    instrumentation: INSTRUMENTATION_STATE.DISCOVERY_ONLY,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: PRODUCT_CADENCE.DAILY,
  },
  {
    code: 'users',
    name: 'Users',
    area: PRODUCT_AREAS.ADMINISTRATION_AND_SECURITY,
    evidence: 'routes',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: PRODUCT_CADENCE.AD_HOC,
  },
  {
    code: 'roles',
    name: 'Roles',
    area: PRODUCT_AREAS.ADMINISTRATION_AND_SECURITY,
    evidence: 'routes',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: PRODUCT_CADENCE.AD_HOC,
  },
  {
    code: 'settings',
    name: 'Settings',
    area: PRODUCT_AREAS.ADMINISTRATION_AND_SECURITY,
    evidence: 'routes',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: PRODUCT_CADENCE.AD_HOC,
  },
  {
    code: 'branches',
    name: 'Branches',
    area: PRODUCT_AREAS.ADMINISTRATION_AND_SECURITY,
    evidence: 'routes',
    instrumentation: INSTRUMENTATION_STATE.NOT_INSTRUMENTED,
    lifecycle: PRODUCT_LIFECYCLE.ACTIVE,
    cadence: PRODUCT_CADENCE.AD_HOC,
  },
]);

/**
 * @returns {ModuleDef[]}
 */
export function listProductModules() {
  return MODULES.map((m) => ({ ...m }));
}

/**
 * @param {string} code
 * @returns {ModuleDef|null}
 */
export function getProductModule(code) {
  const found = MODULES.find((m) => m.code === code);
  return found ? { ...found } : null;
}
