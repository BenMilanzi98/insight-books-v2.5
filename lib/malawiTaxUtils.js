/**
 * Malawi Tax Calculation Utilities
 * Implements 2025 Malawi tax laws for PAYE and NPS calculations
 */

/**
 * Calculate PAYE (Pay As You Earn) tax according to Malawi 2025 tax bands
 * @param {number} monthlyIncome - Monthly gross income in MWK
 * @returns {number} PAYE amount in MWK
 */
export function calculatePAYE(monthlyIncome) {
  if (monthlyIncome <= 0) return 0;
  
  // Malawi 2025 PAYE Tax Bands
  const taxBands = [
    { min: 0, max: 150000, rate: 0.00 },           // 0%
    { min: 150001, max: 500000, rate: 0.25 },      // 25%
    { min: 500001, max: 2550000, rate: 0.30 },     // 30%
    { min: 2550001, max: Infinity, rate: 0.35 }    // 35%
  ];
  
  let totalTax = 0;
  let remainingIncome = monthlyIncome;
  
  for (const band of taxBands) {
    if (remainingIncome <= 0) break;
    
    const taxableInBand = Math.min(remainingIncome, band.max - band.min + 1);
    const taxInBand = taxableInBand * band.rate;
    totalTax += taxInBand;
    remainingIncome -= taxableInBand;
  }
  
  return Math.round(totalTax * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate NPS (National Pension Scheme) contributions
 * @param {number} grossMonthlyEarnings - Monthly gross earnings in MWK
 * @returns {Object} NPS contribution breakdown
 */
export function calculateNPS(grossMonthlyEarnings) {
  const employeeRate = 0.05; // 5% employee contribution
  const employerRate = 0.05; // 5% employer contribution
  const totalRate = 0.10;    // 10% total contribution
  
  const employeeContribution = Math.round(grossMonthlyEarnings * employeeRate * 100) / 100;
  const employerContribution = Math.round(grossMonthlyEarnings * employerRate * 100) / 100;
  const totalContribution = employeeContribution + employerContribution;
  
  return {
    employeeAmount: employeeContribution,
    employerAmount: employerContribution,
    totalAmount: totalContribution,
    employeeRate,
    employerRate,
    totalRate
  };
}

/**
 * Calculate comprehensive payroll deductions for Malawi compliance
 * @param {Object} payrollData - Payroll calculation data
 * @returns {Object} Complete payroll calculation with all deductions
 */
export function calculateMalawiPayroll(payrollData) {
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
  
  // Calculate statutory deductions based on total gross pay
  const payeAmount = calculatePAYE(totalGrossPay);
  const npsCalculation = calculateNPS(totalGrossPay);
  
  // Calculate other deductions - ensure all values are properly accumulated
  // This is critical: all deductions must be added together before subtracting from gross
  const totalOtherDeductions = Object.values(otherDeductions).reduce((sum, amount) => {
    const numAmount = Number(amount) || 0;
    return sum + (isNaN(numAmount) ? 0 : numAmount);
  }, 0);
  
  // Calculate total deductions - ensure all deductions are properly added before subtracting
  // Order: PAYE + NPS Employee + Other Deductions
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
  
  // Warning for high earners (above 2.55M MWK)
  if (payrollData.basicSalary > 2550000) {
    warnings.push('Employee salary exceeds 2.55M MWK - highest tax bracket applies');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get Malawi tax band information for display
 * @returns {Array} Array of tax band objects
 */
export function getMalawiTaxBands() {
  return [
    {
      min: 0,
      max: 150000,
      rate: 0.00,
      ratePercent: '0%',
      description: 'First 150,000 MWK'
    },
    {
      min: 150001,
      max: 500000,
      rate: 0.25,
      ratePercent: '25%',
      description: '150,001 - 500,000 MWK'
    },
    {
      min: 500001,
      max: 2550000,
      rate: 0.30,
      ratePercent: '30%',
      description: '500,001 - 2,550,000 MWK'
    },
    {
      min: 2550001,
      max: Infinity,
      rate: 0.35,
      ratePercent: '35%',
      description: 'Above 2,550,000 MWK'
    }
  ];
}

/**
 * Get NPS contribution information for display
 * @returns {Object} NPS information
 */
export function getNPSInfo() {
  return {
    employeeRate: 0.05,
    employerRate: 0.05,
    totalRate: 0.10,
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


