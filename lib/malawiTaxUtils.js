/**
 * Malawi Tax Calculation Utilities
 * Implements 2025 Malawi tax laws for PAYE and NPS calculations
 */

/**
 * Calculate PAYE (Pay As You Earn) tax according to Malawi 2025/26 tax bands
 * @param {number} monthlyIncome - Monthly gross income in MWK
 * @returns {number} PAYE amount in MWK
 */
export function calculatePAYE(monthlyIncome) {
  if (monthlyIncome <= 0) return 0;
  
  // Malawi 2025/26 PAYE Tax Bands
  const taxBands = [
    { min: 0, max: 170000, rate: 0.00 },              // 0% (tax-free)
    { min: 170001, max: 1570000, rate: 0.30 },        // 30%
    { min: 1570001, max: 10000000, rate: 0.35 },      // 35%
    { min: 10000001, max: Infinity, rate: 0.40 }      // 40%
  ];
  
  let totalTax = 0;
  let remainingIncome = monthlyIncome;
  
  for (const band of taxBands) {
    if (remainingIncome <= 0) break;
    
    if (remainingIncome <= band.max) {
      // Income falls within this band
      const taxableInBand = remainingIncome - (band.min > 0 ? band.min - 1 : 0);
      if (taxableInBand > 0) {
        const taxInBand = taxableInBand * band.rate;
        totalTax += taxInBand;
      }
      break;
    } else {
      // Income exceeds this band, calculate tax for the full band
      const bandSize = band.max - (band.min > 0 ? band.min - 1 : 0);
      const taxInBand = bandSize * band.rate;
      totalTax += taxInBand;
      remainingIncome -= bandSize;
    }
  }
  
  return Math.round(totalTax * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate NPS (National Pension Scheme) contributions
 * @param {number} grossMonthlyEarnings - Monthly gross earnings in MWK
 * @returns {Object} NPS contribution breakdown
 */
export function calculateNPS(grossMonthlyEarnings, employeeRatePercent = 5, employerRatePercent = 5) {
  const employeeRate = (Number(employeeRatePercent) || 0) / 100; // percent -> fraction
  const employerRate = (Number(employerRatePercent) || 0) / 100; // percent -> fraction
  const totalRate = employeeRate + employerRate;
  
  const employeeContribution = Math.round(grossMonthlyEarnings * employeeRate * 100) / 100;
  const employerContribution = Math.round(grossMonthlyEarnings * employerRate * 100) / 100;
  const totalContribution = employeeContribution + employerContribution;
  
  return {
    employeeAmount: employeeContribution,
    employerAmount: employerContribution,
    totalAmount: totalContribution,
    employeeRate: Number(employeeRatePercent) || 0,
    employerRate: Number(employerRatePercent) || 0,
    totalRate: (Number(employeeRatePercent) || 0) + (Number(employerRatePercent) || 0)
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
  
  // Calculate gross pay - ensure all values are numeric
  const numBasicSalary = Number(basicSalary) || 0;
  const totalAllowances = Object.values(allowances).reduce((sum, amount) => {
    const numAmount = Number(amount) || 0;
    return sum + (isNaN(numAmount) ? 0 : numAmount);
  }, 0);
  const grossPay = numBasicSalary + totalAllowances;
  
  // Calculate overtime pay if applicable
  const numOvertimeHours = Number(overtimeHours) || 0;
  const numOvertimeRate = Number(overtimeRate) || 0;
  const overtimePay = numOvertimeHours * numOvertimeRate;
  const totalGrossPay = grossPay + overtimePay;
  
  // Calculate statutory deductions based on total gross pay (only if selected)
  const payeAmount = applyPAYE ? calculatePAYE(totalGrossPay) : 0;
  const employeeRatePercent = npsRates?.employeeRatePercent ?? 5;
  const employerRatePercent = npsRates?.employerRatePercent ?? 5;
  const npsCalculation = applyNPS
    ? calculateNPS(totalGrossPay, employeeRatePercent, employerRatePercent)
    : { employeeAmount: 0, employerAmount: 0, totalAmount: 0, employeeRate: 0, employerRate: 0, totalRate: 0 };
  
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
  
  // Calculate net pay - ensure it's never negative
  // Formula: Net Pay = Total Gross Pay - Total Deductions
  const numTotalGrossPay = Number(totalGrossPay) || 0;
  const numTotalDeductions = Number(totalDeductions) || 0;
  const netPay = Math.max(0, numTotalGrossPay - numTotalDeductions);
  
  return {
    // Basic calculations
    basicSalary,
    totalAllowances,
    grossPay,
    overtimePay,
    totalGrossPay,
    
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
    }
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
    payeAmount,
    npsEmployeeAmount,
    npsEmployerAmount,
    totalNpsAmount,
    netPay
  } = payrollCalculation;
  
  const entries = [];
  
  // Debit: Salaries Expense
  entries.push({
    accountName: 'Salaries Expense',
    debit: totalGrossPay,
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
 * Get Malawi tax band information for display (2025/26)
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
export function calculateStatutoryRemittances(payrolls) {
  const totalPAYE = payrolls.reduce((sum, payroll) => sum + (payroll.payeAmount || 0), 0);
  const totalNPSEmployee = payrolls.reduce((sum, payroll) => sum + (payroll.npsEmployeeAmount || 0), 0);
  const totalNPSEmployer = payrolls.reduce((sum, payroll) => sum + (payroll.npsEmployerAmount || 0), 0);
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


