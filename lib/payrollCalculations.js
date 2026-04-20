// lib/payrollCalculations.js
import { computeMalawiPayeMonthly } from './malawiPAYE';

/**
 * Malawi PAYE (monthly gross, MWK) — single source of truth in {@link ./malawiPAYE.js}.
 * @returns {{ payeAmount: number, breakdown: Array<{ bracket: string, taxableAmount: number, rate: number, tax: number }> }}
 */
export function calculatePAYE(grossSalary) {
  return computeMalawiPayeMonthly(grossSalary);
}

/**
 * Calculate NPS (National Pension Scheme) contributions.
 * Rates are tenant-configurable; null/undefined means 0%.
 */
export function calculateNPS(grossSalary, employeeRatePercent, employerRatePercent) {
  const salary = parseFloat(grossSalary) || 0;
  const empPct = Number(employeeRatePercent);
  const erPct = Number(employerRatePercent);
  const employeeRate = (Number.isFinite(empPct) ? empPct : 0) / 100;
  const employerRate = (Number.isFinite(erPct) ? erPct : 0) / 100;
  const employeeContribution = salary * employeeRate;
  const employerContribution = salary * employerRate;
  const totalContribution = employeeContribution + employerContribution;

  return {
    employeeAmount: Math.round(employeeContribution * 100) / 100,
    employerAmount: Math.round(employerContribution * 100) / 100,
    totalAmount: Math.round(totalContribution * 100) / 100,
    employeeRatePercent: Number.isFinite(empPct) ? empPct : 0,
    employerRatePercent: Number.isFinite(erPct) ? erPct : 0
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
  // IMPORTANT: NPS should only apply when the statutory NPS deduction is selected.
  // Do NOT trigger NPS just because a custom deduction contains the word "pension".
  const hasNPS = selectedDeductions.some(d => {
    if (!d?.name) return false;
    const name = d.name.toLowerCase();
    return name.includes('nps') || (d.isStatutory && name.includes('pension'));
  });
  
  let npsCalculation = { employeeAmount: 0, employerAmount: 0, totalAmount: 0 };
  if (hasNPS) {
    const employeeRatePercent = options.npsEmployeeRatePercent ?? 0;
    const employerRatePercent = options.npsEmployerRatePercent ?? 0;
    npsCalculation = calculateNPS(salary, employeeRatePercent, employerRatePercent);
  }
  
  // Calculate custom deductions (excluding PAYE and NPS)
  const customDeductions = selectedDeductions.filter(d => {
    if (!d.name) return true;
    const nameLower = d.name.toLowerCase();
    const isNpsDeduction = nameLower.includes('nps') || (d.isStatutory && nameLower.includes('pension'));
    return !nameLower.includes('paye') && 
           !nameLower.includes('income tax') &&
           !isNpsDeduction &&
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
