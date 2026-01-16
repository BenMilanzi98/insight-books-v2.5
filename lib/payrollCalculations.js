// lib/payrollCalculations.js
/**
 * Calculate Malawi PAYE (Pay As You Earn) tax based on 2025/26 tax brackets
 * Formula:
 * - Up to MK 170,000 - 0% (tax-free)
 * - MK 170,001 – 1,570,000 - 30%
 * - MK 1,570,001 – 10,000,000 - 35%
 * - Above MK 10,000,000 - 40%
 */
export function calculatePAYE(grossSalary) {
  const salary = parseFloat(grossSalary) || 0;
  
  if (salary <= 0) {
    return {
      payeAmount: 0,
      breakdown: []
    };
  }

  let payeAmount = 0;
  const breakdown = [];

  // Up to MK 170,000 - 0% (tax-free)
  if (salary <= 170000) {
    breakdown.push({
      bracket: "Up to MK 170,000 (tax-free)",
      taxableAmount: salary,
      rate: 0,
      tax: 0
    });
    return { payeAmount: 0, breakdown };
  } else {
    breakdown.push({
      bracket: "Up to MK 170,000 (tax-free)",
      taxableAmount: 170000,
      rate: 0,
      tax: 0
    });
  }

  // MK 170,001 – 1,570,000 - 30%
  if (salary > 1570000) {
    // Full bracket
    const taxableAmount = 1570000 - 170000; // 1,400,000
    const tax = taxableAmount * 0.30;
    breakdown.push({
      bracket: "MK 170,001 – 1,570,000",
      taxableAmount: taxableAmount,
      rate: 30,
      tax: tax
    });
    payeAmount += tax;
  } else if (salary > 170000) {
    // Partial bracket
    const taxableAmount = salary - 170000;
    const tax = taxableAmount * 0.30;
    breakdown.push({
      bracket: "MK 170,001 – 1,570,000",
      taxableAmount: taxableAmount,
      rate: 30,
      tax: tax
    });
    payeAmount += tax;
    return { payeAmount, breakdown };
  }

  // MK 1,570,001 – 10,000,000 - 35%
  if (salary > 10000000) {
    // Full bracket
    const taxableAmount = 10000000 - 1570000; // 8,430,000
    const tax = taxableAmount * 0.35;
    breakdown.push({
      bracket: "MK 1,570,001 – 10,000,000",
      taxableAmount: taxableAmount,
      rate: 35,
      tax: tax
    });
    payeAmount += tax;
  } else if (salary > 1570000) {
    // Partial bracket
    const taxableAmount = salary - 1570000;
    const tax = taxableAmount * 0.35;
    breakdown.push({
      bracket: "MK 1,570,001 – 10,000,000",
      taxableAmount: taxableAmount,
      rate: 35,
      tax: tax
    });
    payeAmount += tax;
    return { payeAmount, breakdown };
  }

  // Above MK 10,000,000 - 40%
  if (salary > 10000000) {
    const taxableAmount = salary - 10000000;
    const tax = taxableAmount * 0.40;
    breakdown.push({
      bracket: "Above MK 10,000,000",
      taxableAmount: taxableAmount,
      rate: 40,
      tax: tax
    });
    payeAmount += tax;
  }

  return {
    payeAmount: Math.round(payeAmount * 100) / 100, // Round to 2 decimal places
    breakdown
  };
}

/**
 * Calculate NPS (National Pension Scheme) contributions
 * Employee: 5% of gross salary
 * Employer: 5% of gross salary
 */
export function calculateNPS(grossSalary, employeeRatePercent = 5, employerRatePercent = 5) {
  const salary = parseFloat(grossSalary) || 0;
  const employeeRate = (Number(employeeRatePercent) || 0) / 100;
  const employerRate = (Number(employerRatePercent) || 0) / 100;
  const employeeContribution = salary * employeeRate;
  const employerContribution = salary * employerRate;
  const totalContribution = employeeContribution + employerContribution;

  return {
    employeeAmount: Math.round(employeeContribution * 100) / 100,
    employerAmount: Math.round(employerContribution * 100) / 100,
    totalAmount: Math.round(totalContribution * 100) / 100,
    employeeRatePercent: Number(employeeRatePercent) || 0,
    employerRatePercent: Number(employerRatePercent) || 0
  };
}

/**
 * Calculate custom deductions
 */
export function calculateCustomDeductions(grossSalary, deductions = []) {
  const salary = parseFloat(grossSalary) || 0;
  let totalDeductions = 0;
  const breakdown = [];

  deductions.forEach(deduction => {
    if (!deduction) return;

    const name = deduction.name || 'Custom Deduction';
    const percentageValue = typeof deduction.percentage === 'number' ? deduction.percentage : (
      deduction.type === 'percentage' && deduction.value !== undefined ? Number(deduction.value) : null
    );
    const fixedValue = typeof deduction.amount === 'number' ? deduction.amount : (
      deduction.type === 'fixed' && deduction.value !== undefined ? Number(deduction.value) : null
    );

    let amount = 0;
    let deductionType = 'fixed';

    if (percentageValue !== null && !Number.isNaN(percentageValue)) {
      amount = salary * (percentageValue / 100);
      deductionType = 'percentage';
    } else if (fixedValue !== null && !Number.isNaN(fixedValue)) {
      amount = fixedValue;
      deductionType = 'fixed';
    }

    amount = Math.round(amount * 100) / 100;
    totalDeductions += amount;

    breakdown.push({
      name,
      type: deductionType,
      percentage: deductionType === 'percentage' ? percentageValue : null,
      amount
    });
  });

  return {
    totalAmount: Math.round(totalDeductions * 100) / 100,
    breakdown
  };
}

/**
 * Calculate complete payroll based on selected deductions
 */
export function calculatePayroll(grossSalary, selectedDeductions = [], options = {}) {
  const salary = parseFloat(grossSalary) || 0;
  
  // Check if PAYE is selected (optional - only calculate if selected)
  const hasPAYE = selectedDeductions.some(d => 
    d.name && (
      d.name.toLowerCase().includes('paye') || 
      d.name.toLowerCase().includes('income tax') ||
      (d.isStatutory && d.name.toLowerCase().includes('tax'))
    )
  );
  
  // Only calculate PAYE if it's selected
  let payeCalculation = { payeAmount: 0, breakdown: [] };
  if (hasPAYE) {
    payeCalculation = calculatePAYE(salary);
  }
  
  // Check if NPS is selected (optional - only calculate if selected)
  const hasNPS = selectedDeductions.some(d => 
    d.name && (
      d.name.toLowerCase().includes('nps') || 
      d.name.toLowerCase().includes('pension')
    )
  );
  
  let npsCalculation = { employeeAmount: 0, employerAmount: 0, totalAmount: 0 };
  if (hasNPS) {
    const employeeRatePercent = options.npsEmployeeRatePercent ?? 5;
    const employerRatePercent = options.npsEmployerRatePercent ?? 5;
    npsCalculation = calculateNPS(salary, employeeRatePercent, employerRatePercent);
  }
  
  // Calculate custom deductions (excluding PAYE and NPS)
  const customDeductions = selectedDeductions.filter(d => {
    if (!d.name) return true;
    const nameLower = d.name.toLowerCase();
    return !nameLower.includes('paye') && 
           !nameLower.includes('income tax') &&
           !nameLower.includes('nps') &&
           !nameLower.includes('pension') &&
           !(d.isStatutory && nameLower.includes('tax'));
  });
  const customDeductionsCalculation = calculateCustomDeductions(salary, customDeductions);
  
  // Calculate net pay
  const totalDeductions = payeCalculation.payeAmount + npsCalculation.employeeAmount + customDeductionsCalculation.totalAmount;
  const netPay = salary - totalDeductions;

  return {
    grossSalary: salary,
    paye: payeCalculation,
    nps: npsCalculation,
    customDeductions: customDeductionsCalculation,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    netPay: Math.round(netPay * 100) / 100,
    breakdown: {
      grossSalary: salary,
      deductions: [
        ...(hasPAYE ? payeCalculation.breakdown.map(item => ({ ...item, type: 'PAYE' })) : []),
        ...(hasNPS ? [{ name: 'NPS Employee Contribution', amount: npsCalculation.employeeAmount, type: 'NPS' }] : []),
        ...customDeductionsCalculation.breakdown.map(item => ({ ...item, type: 'Custom' }))
      ],
      netPay: netPay
    }
  };
}
