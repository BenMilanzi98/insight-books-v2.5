/**
 * Malawi Tax Calculation Utilities
 * Implements Malawi PAYE (2026 bands) and NPS calculations.
 *
 * PAYE and NPS are calculated separately from **basic salary + overtime** only.
 * **Allowances** (benefit amounts) are not included in either base; they are
 * **added to net pay after** statutory deductions.
 */

import { computeMalawiPayeMonthly } from './malawiPAYE';
import { effectiveNpsRatePercentForPayroll } from './npsTenantRates';
import { getPayrollStatutoryBreakdown } from './payrollStatutoryBreakdown';

/**
 * Calculate PAYE (Pay As You Earn) on **monthly taxable income** (MWK), band-by-band.
 * @param {number} monthlyTaxableIncome - Monthly gross income used for PAYE bands
 * @returns {number} PAYE amount in MWK
 */
export function calculatePAYE(monthlyTaxableIncome) {
  return computeMalawiPayeMonthly(monthlyTaxableIncome).payeAmount;
}

/**
 * Calculate NPS (National Pension Scheme) contributions
 * @param {number} grossMonthlyEarnings - Monthly gross earnings in MWK
 * @returns {Object} NPS contribution breakdown
 */
export function calculateNPS(grossMonthlyEarnings, employeeRatePercent = 5, employerRatePercent = 5) {
  const empPct = Number(employeeRatePercent);
  const erPct = Number(employerRatePercent);
  const employeeRate = (Number.isFinite(empPct) ? empPct : 0) / 100;
  const employerRate = (Number.isFinite(erPct) ? erPct : 0) / 100;

  const employeeContribution = Math.round(grossMonthlyEarnings * employeeRate * 100) / 100;
  const employerContribution = Math.round(grossMonthlyEarnings * employerRate * 100) / 100;
  const totalContribution = employeeContribution + employerContribution;
  
  return {
    employeeAmount: employeeContribution,
    employerAmount: employerContribution,
    totalAmount: totalContribution,
    employeeRate: Number.isFinite(empPct) ? empPct : 0,
    employerRate: Number.isFinite(erPct) ? erPct : 0,
    totalRate: (Number.isFinite(empPct) ? empPct : 0) + (Number.isFinite(erPct) ? erPct : 0),
  };
}

/**
 * Calculate comprehensive payroll deductions for Malawi compliance
 * @param {Object} payrollData - Payroll calculation data
 * @param {boolean} applyPAYE - Whether to apply PAYE deduction (default: false, optional)
 * @param {boolean} applyNPS - Whether to apply NPS deduction (default: false, optional)
 * @returns {Object} Complete payroll calculation with all deductions
 */
export function calculateMalawiPayroll(payrollData, applyPAYE = false, applyNPS = false, npsRates = null) {
  const {
    basicSalary = 0,
    allowances = {},
    otherDeductions = {},
    hoursWorked = 0,
    hourlyRate = 0,
    overtimeHours = 0,
    overtimeRate = 0
  } = payrollData;
  
  const numBasicSalary = Number(basicSalary) || 0;
  const totalAllowances = Object.values(allowances).reduce((sum, amount) => {
    const numAmount = Number(amount) || 0;
    return sum + (isNaN(numAmount) ? 0 : numAmount);
  }, 0);

  const numOvertimeHours = Number(overtimeHours) || 0;
  const numOvertimeRate = Number(overtimeRate) || 0;
  const overtimePay = numOvertimeHours * numOvertimeRate;

  /** PAYE / NPS base: basic + overtime only (allowances go to net after tax). */
  const taxableGrossPay = numBasicSalary + overtimePay;

  const employeeRatePercent = effectiveNpsRatePercentForPayroll(
    npsRates?.employeeRatePercent,
    applyNPS,
  );
  const employerRatePercent = effectiveNpsRatePercentForPayroll(
    npsRates?.employerRatePercent,
    applyNPS,
  );
  const npsCalculation = applyNPS
    ? calculateNPS(taxableGrossPay, employeeRatePercent, employerRatePercent)
    : { employeeAmount: 0, employerAmount: 0, totalAmount: 0, employeeRate: 0, employerRate: 0, totalRate: 0 };

  // PAYE and employee NPS are separate statutory deductions from gross.
  const payeTaxableIncome = Math.max(0, taxableGrossPay);
  const payeAmount = applyPAYE ? calculatePAYE(payeTaxableIncome) : 0;
  
  // Calculate other deductions - ensure all values are properly accumulated
  // This is critical: all deductions must be added together before subtracting from gross
  const totalOtherDeductions = Object.values(otherDeductions).reduce((sum, amount) => {
    const numAmount = Number(amount) || 0;
    return sum + (isNaN(numAmount) ? 0 : numAmount);
  }, 0);
  
  // Calculate total deductions - ensure all deductions are properly added before subtracting
  // Order: PAYE (if selected) + NPS Employee (if selected) + Other Deductions
  const numPaye = Number(payeAmount) || 0;
  const numNpsEmployee = Number(npsCalculation.employeeAmount) || 0;
  const numOtherDeductions = Number(totalOtherDeductions) || 0;
  const totalDeductions = numPaye + numNpsEmployee + numOtherDeductions;
  
  const numTaxableGross = Number(taxableGrossPay) || 0;
  const numTotalDeductions = Number(totalDeductions) || 0;
  // Allowances are paid with net (not in PAYE/NPS base).
  const netPay = Math.max(0, numTaxableGross - numTotalDeductions + totalAllowances);

  return {
    basicSalary,
    totalAllowances,
    /** Basic + overtime — PAYE/NPS base (excludes allowances). */
    grossPay: numTaxableGross,
    overtimePay,
    /** Same as grossPay: taxable earnings used for statutory deductions. */
    totalGrossPay: numTaxableGross,

    /** Monthly gross income used for PAYE brackets. */
    payeTaxableIncome,

    // Statutory deductions
    payeAmount,
    npsEmployeeAmount: npsCalculation.employeeAmount,
    npsEmployerAmount: npsCalculation.employerAmount,
    totalNpsAmount: npsCalculation.totalAmount,
    
    // Other deductions
    otherDeductions,
    totalOtherDeductions,
    
    // Final calculations
    totalDeductions,
    netPay,
    
    // Additional info
    hoursWorked,
    overtimeHours,
    allowances,
    npsRates: {
      employeeRate: npsCalculation.employeeRate,
      employerRate: npsCalculation.employerRate,
      totalRate: npsCalculation.totalRate
    },
    // Rates actually used in math (for payslips / audit — matches amounts, not raw tenant nulls)
    npsRatesApplied: {
      employeeRatePercent: applyNPS ? employeeRatePercent : 0,
      employerRatePercent: applyNPS ? employerRatePercent : 0,
    },
  };
}

/**
 * Generate journal entries for payroll posting
 * @param {Object} payrollCalculation - Result from calculateMalawiPayroll
 * @param {string} tenantId - Tenant ID
 * @returns {Array} Array of journal entry objects
 */
export function generatePayrollJournalEntries(payrollCalculation, tenantId) {
  const {
    totalGrossPay,
    totalAllowances = 0,
    payeAmount,
    npsEmployeeAmount,
    npsEmployerAmount,
    totalNpsAmount,
    netPay
  } = payrollCalculation;

  const taxable = Number(totalGrossPay) || 0;
  const allowancesAmt = Number(totalAllowances) || 0;
  const employerNpsAmt = Number(npsEmployerAmount) || 0;
  const salaryExpenseDebit = taxable + allowancesAmt + employerNpsAmt;

  const entries = [];

  // Debit: full employment cost (gross + benefits paid through net + employer NPS)
  entries.push({
    accountName: 'Salaries & Wages',
    accountCode: '5200',
    debit: salaryExpenseDebit,
    credit: 0,
    description: 'Monthly payroll - gross salaries'
  });
  
  // Credit: PAYE Liability
  if (payeAmount > 0) {
    entries.push({
      accountName: 'PAYE Liability',
      debit: 0,
      credit: payeAmount,
      description: 'PAYE tax liability'
    });
  }
  
  // Credit: NPS Employee Contribution Liability
  if (npsEmployeeAmount > 0) {
    entries.push({
      accountName: 'NPS Employee Contribution Liability',
      debit: 0,
      credit: npsEmployeeAmount,
      description: 'NPS employee contribution liability'
    });
  }
  
  // Credit: NPS Employer Contribution Liability
  if (npsEmployerAmount > 0) {
    entries.push({
      accountName: 'NPS Employer Contribution Liability',
      debit: 0,
      credit: npsEmployerAmount,
      description: 'NPS employer contribution liability'
    });
  }
  
  // Credit: Cash/Bank (Net Pay)
  entries.push({
    accountName: 'Cash',
    debit: 0,
    credit: netPay,
    description: 'Net pay to employees'
  });
  
  return entries;
}

/**
 * Validate payroll data for Malawi compliance
 * @param {Object} payrollData - Payroll data to validate
 * @returns {Object} Validation result with errors and warnings
 */
export function validatePayrollData(payrollData) {
  const errors = [];
  const warnings = [];
  
  // Required fields validation
  if (!payrollData.basicSalary || payrollData.basicSalary <= 0) {
    errors.push('Basic salary is required and must be greater than 0');
  }
  
  // NPS compliance validation
  if (payrollData.basicSalary > 0) {
    const npsCalculation = calculateNPS(payrollData.basicSalary);
    if (npsCalculation.totalAmount < 0) {
      errors.push('NPS calculation resulted in negative amount');
    }
  }
  
  // PAYE validation
  if (payrollData.basicSalary > 0) {
    const payeAmount = calculatePAYE(payrollData.basicSalary);
    if (payeAmount < 0) {
      errors.push('PAYE calculation resulted in negative amount');
    }
  }
  
  // Warning for high earners (above 10M MWK - highest bracket)
  if (payrollData.basicSalary > 10000000) {
    warnings.push('Employee salary exceeds 10M MWK - highest tax bracket (40%) applies');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get Malawi tax band information for display (2026)
 * @returns {Array} Array of tax band objects
 */
export function getMalawiTaxBands() {
  return [
    {
      min: 0,
      max: 170000,
      rate: 0.00,
      ratePercent: '0%',
      description: 'Up to 170,000 MWK (tax-free)'
    },
    {
      min: 170001,
      max: 1570000,
      rate: 0.30,
      ratePercent: '30%',
      description: '170,001 - 1,570,000 MWK'
    },
    {
      min: 1570001,
      max: 10000000,
      rate: 0.35,
      ratePercent: '35%',
      description: '1,570,001 - 10,000,000 MWK'
    },
    {
      min: 10000001,
      max: Infinity,
      rate: 0.40,
      ratePercent: '40%',
      description: 'Above 10,000,000 MWK'
    }
  ];
}

/**
 * Get NPS contribution information for display
 * @returns {Object} NPS information
 */
export function getNPSInfo() {
  return {
    employeeRate: 5,
    employerRate: 5,
    totalRate: 10,
    employeeRatePercent: '5%',
    employerRatePercent: '5%',
    totalRatePercent: '10%',
    description: 'National Pension Scheme contributions',
    remittanceDeadline: '14th day of the following month'
  };
}

/**
 * Calculate statutory remittance amounts for reporting
 * @param {Array} payrolls - Array of payroll objects for a period
 * @returns {Object} Statutory remittance summary
 */
export function calculateStatutoryRemittances(payrolls, options = {}) {
  const totals = payrolls.reduce(
    (sum, payroll) => {
      const statutory = getPayrollStatutoryBreakdown(payroll, {
        ...options,
        signed: options.signed ?? true,
      });
      sum.paye += statutory.payeAmount;
      sum.npsEmployee += statutory.npsEmployeeAmount;
      sum.npsEmployer += statutory.npsEmployerAmount;
      return sum;
    },
    { paye: 0, npsEmployee: 0, npsEmployer: 0 },
  );
  const totalPAYE = totals.paye;
  const totalNPSEmployee = totals.npsEmployee;
  const totalNPSEmployer = totals.npsEmployer;
  const totalNPS = totalNPSEmployee + totalNPSEmployer;
  
  return {
    paye: {
      amount: totalPAYE,
      description: 'PAYE Tax to be remitted to Malawi Revenue Authority'
    },
    nps: {
      employeeAmount: totalNPSEmployee,
      employerAmount: totalNPSEmployer,
      totalAmount: totalNPS,
      description: 'NPS contributions to be remitted to pension fund administrator'
    },
    totalStatutory: totalPAYE + totalNPS,
    remittanceDeadline: '14th day of the following month'
  };
}


