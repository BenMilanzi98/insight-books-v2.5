// lib/payrollCalculations.js
import { computeMalawiPayeMonthly } from './malawiPAYE';
import { effectiveNpsRatePercentForPayroll } from './npsTenantRates';

/**
 * Malawi PAYE on **monthly taxable income** (MWK) — slabs in {@link ./malawiPAYE.js}.
 * @returns {{ payeAmount: number, breakdown: Array<{ bracket: string, taxableAmount: number, rate: number, tax: number }> }}
 */
export function calculatePAYE(monthlyTaxableIncome) {
  return computeMalawiPayeMonthly(monthlyTaxableIncome);
}

/**
 * Calculate NPS (National Pension Scheme) contributions from **resolved** percentage points.
 * Callers should pass rates from {@link effectiveNpsRatePercentForPayroll} so tenant custom % and statutory defaults apply.
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
  
  // Check if NPS is selected (optional - only calculate if selected)
  // IMPORTANT: NPS should only apply when the statutory NPS deduction is selected.
  // Do NOT trigger NPS just because a custom deduction contains the word "pension".
  const hasNPS = selectedDeductions.some(d => {
    if (!d?.name) return false;
    const name = d.name.toLowerCase();
    return name.includes('nps') || (d.isStatutory && name.includes('pension'));
  });

  const employeeRatePercent = effectiveNpsRatePercentForPayroll(
    options.npsEmployeeRatePercent,
    hasNPS,
  );
  const employerRatePercent = effectiveNpsRatePercentForPayroll(
    options.npsEmployerRatePercent,
    hasNPS,
  );

  let npsCalculation = {
    employeeAmount: 0,
    employerAmount: 0,
    totalAmount: 0,
    employeeRatePercent: 0,
    employerRatePercent: 0,
  };
  if (hasNPS) {
    npsCalculation = calculateNPS(salary, employeeRatePercent, employerRatePercent);
  }

  // PAYE: Malawi — taxable income = gross minus employee pension (NPS) when NPS applies.
  const payeTaxableBase = Math.max(
    0,
    salary - (hasNPS ? (Number(npsCalculation.employeeAmount) || 0) : 0),
  );
  let payeCalculation = { payeAmount: 0, breakdown: [] };
  if (hasPAYE) {
    payeCalculation = calculatePAYE(payeTaxableBase);
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
    /** Income used for PAYE brackets (gross minus employee NPS when NPS applies). */
    payeTaxableIncome: hasPAYE ? payeTaxableBase : 0,
    paye: payeCalculation,
    nps: npsCalculation,
    /** Percentage points actually used for NPS (tenant custom or statutory default when unset). */
    npsRatesApplied: {
      employeeRatePercent: hasNPS ? employeeRatePercent : 0,
      employerRatePercent: hasNPS ? employerRatePercent : 0,
    },
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
