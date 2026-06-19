/**
 * Unified payroll calculation engine — single source of truth for statutory payroll math.
 * Re-exports canonical helpers and adds tax-configuration-aware PAYE.
 */
export {
  toPayrollNumber,
  deductionRowForCalculation,
  calculatePAYE,
  calculateNPS,
  calculateCustomDeductions,
  calculatePayroll,
} from '@/lib/payrollCalculations';

export { calculateMalawiPayroll, generatePayrollJournalEntries } from '@/lib/malawiTaxUtils';

export {
  loadActivePayrollTaxConfiguration,
  computePayeForConfiguration,
  computePayeFromBands,
  assertPayrollTaxConfigurationReady,
  ensureDefaultPayrollTaxConfiguration,
  getDefaultMalawiTaxConfiguration,
  DEFAULT_MALAWI_TAX_BANDS,
} from '@/lib/payrollEngine/taxConfiguration';

export {
  loadPayrollAccountMappings,
  resolvePayrollAccountMappings,
  validatePayrollAccountMappings,
  assertPayrollAccountMappingsReady,
  savePayrollAccountMappings,
  PAYROLL_MAPPING_KEYS,
} from '@/lib/payrollEngine/accountMappings';

export {
  buildPayeSummaryReport,
  payrollToPayeSummaryRow,
} from '@/lib/payrollEngine/payeSummaryService';

export { getPayrollStatutoryBreakdown, parsePayrollNotes } from '@/lib/payrollStatutoryBreakdown';

import { calculatePAYE as legacyCalculatePAYE } from '@/lib/payrollCalculations';
import {
  loadActivePayrollTaxConfiguration,
  computePayeForConfiguration,
} from '@/lib/payrollEngine/taxConfiguration';

/**
 * PAYE using tenant tax configuration when available.
 * @param {string} tenantId
 * @param {number} monthlyTaxableIncome
 * @param {Date|string} [asOf]
 */
export async function calculatePayeForTenant(tenantId, monthlyTaxableIncome, asOf = new Date()) {
  const config = await loadActivePayrollTaxConfiguration(tenantId, asOf);
  if (config.isDefault) {
    return legacyCalculatePAYE(monthlyTaxableIncome);
  }
  return computePayeForConfiguration(monthlyTaxableIncome, config);
}
