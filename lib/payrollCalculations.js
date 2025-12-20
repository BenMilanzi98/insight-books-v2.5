// lib/payrollCalculations.js
/**
 * Calculate Malawi PAYE (Pay As You Earn) tax based on 2025 tax brackets
 * Formula:
 * - First MK 150,000 - 0%
 * - Next MK 350,000 (150,001 - 500,000) - 25%
 * - Next MK 2,050,000 (500,001 - 2,550,000) - 30%
 * - Excess of MK 2,550,000 - 35%
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

  // First MK 150,000 - 0%
  if (salary > 150000) {
    breakdown.push({
      bracket: "First MK 150,000",
      taxableAmount: 150000,
      rate: 0,
      tax: 0
    });
    payeAmount += 0;
  } else {
    breakdown.push({
      bracket: "First MK 150,000",
      taxableAmount: salary,
      rate: 0,
      tax: 0
    });
    return { payeAmount: 0, breakdown };
  }

  // Next MK 350,000 (150,001 - 500,000) - 25%
  if (salary > 500000) {
    const taxableAmount = 350000;
    const tax = taxableAmount * 0.25;
    breakdown.push({
      bracket: "Next MK 350,000 (150,001 - 500,000)",
      taxableAmount: taxableAmount,
      rate: 25,
      tax: tax
    });
    payeAmount += tax;
  } else if (salary > 150000) {
    const taxableAmount = salary - 150000;
    const tax = taxableAmount * 0.25;
    breakdown.push({
      bracket: "Next MK 350,000 (150,001 - 500,000)",
      taxableAmount: taxableAmount,
      rate: 25,
      tax: tax
    });
    payeAmount += tax;
    return { payeAmount, breakdown };
  }

  // Next MK 2,050,000 (500,001 - 2,550,000) - 30%
  if (salary > 2550000) {
    const taxableAmount = 2050000;
    const tax = taxableAmount * 0.30;
    breakdown.push({
      bracket: "Next MK 2,050,000 (500,001 - 2,550,000)",
      taxableAmount: taxableAmount,
      rate: 30,
      tax: tax
    });
    payeAmount += tax;
  } else if (salary > 500000) {
    const taxableAmount = salary - 500000;
    const tax = taxableAmount * 0.30;
    breakdown.push({
      bracket: "Next MK 2,050,000 (500,001 - 2,550,000)",
      taxableAmount: taxableAmount,
      rate: 30,
      tax: tax
    });
    payeAmount += tax;
    return { payeAmount, breakdown };
  }

  // Excess of MK 2,550,000 - 35%
  if (salary > 2550000) {
    const taxableAmount = salary - 2550000;
    const tax = taxableAmount * 0.35;
    breakdown.push({
      bracket: "Excess of MK 2,550,000",
      taxableAmount: taxableAmount,
      rate: 35,
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
export function calculateNPS(grossSalary) {
  const salary = parseFloat(grossSalary) || 0;
  const employeeContribution = salary * 0.05;
  const employerContribution = salary * 0.05;
  const totalContribution = employeeContribution + employerContribution;

  return {
    employeeAmount: Math.round(employeeContribution * 100) / 100,
    employerAmount: Math.round(employerContribution * 100) / 100,
    totalAmount: Math.round(totalContribution * 100) / 100
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
export function calculatePayroll(grossSalary, selectedDeductions = []) {
  const salary = parseFloat(grossSalary) || 0;
  
  let payeCalculation = { payeAmount: 0, breakdown: [] };
  let npsCalculation = { employeeAmount: 0, employerAmount: 0, totalAmount: 0 };
  let customDeductionsCalculation = { totalAmount: 0, breakdown: [] };
  
  // Check if PAYE is selected
  const hasPAYE = selectedDeductions.some(d => d.name && d.name.toLowerCase().includes('paye'));
  if (hasPAYE) {
    payeCalculation = calculatePAYE(salary);
  }
  
  // Check if NPS is selected
  const hasNPS = selectedDeductions.some(d => d.name && d.name.toLowerCase().includes('nps'));
  if (hasNPS) {
    npsCalculation = calculateNPS(salary);
  }
  
  // Calculate custom deductions (excluding PAYE and NPS)
  const customDeductions = selectedDeductions.filter(d => 
    !d.name.toLowerCase().includes('paye') && 
    !d.name.toLowerCase().includes('nps')
  );
  customDeductionsCalculation = calculateCustomDeductions(salary, customDeductions);
  
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
        ...payeCalculation.breakdown.map(item => ({ ...item, type: 'PAYE' })),
        ...(hasNPS ? [{ name: 'NPS Employee Contribution', amount: npsCalculation.employeeAmount, type: 'NPS' }] : []),
        ...customDeductionsCalculation.breakdown.map(item => ({ ...item, type: 'Custom' }))
      ],
      netPay: netPay
    }
  };
}
