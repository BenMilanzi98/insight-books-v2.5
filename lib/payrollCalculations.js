// lib/payrollCalculations.js
import { computeMalawiPayeMonthly } from './malawiPAYE';
import { effectiveNpsRatePercentForPayroll } from './npsTenantRates';
import { deductionMatchesNps, deductionMatchesPaye } from './payrollDeductionMatching';

/**
 * Parse a payroll monetary input (API JSON, Prisma Decimal, comma-separated strings).
 * @param {unknown} value
 * @returns {number|null} finite number, or null if missing/invalid
 */
export function toPayrollNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'object' && value !== null) {
    if (typeof value.toNumber === 'function') {
      try {
        const n = value.toNumber();
        return Number.isFinite(n) ? n : null;
      } catch {
        /* fall through */
      }
    }
    if (typeof value.toString === 'function') {
      const raw = value.toString().replace(/,/g, '').replace(/\s/g, '').trim();
      if (raw === '' || raw === '-') return null;
      const n = parseFloat(raw);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
  const s = String(value).replace(/,/g, '').replace(/\s/g, '').trim();
  if (s === '' || s === '-') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Map a Prisma `Deduction` row or API deduction payload to the shape used by {@link calculateCustomDeductions}.
 * Prefers `percentage` / `amount` columns; falls back to legacy `type` + `value`.
 */
export function deductionRowForCalculation(d) {
  if (!d || typeof d !== 'object') return d;
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    isStatutory: d.isStatutory,
    percentage: d.percentage,
    amount: d.amount,
    type: d.type,
    value: d.value,
  };
}

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
  const salary = toPayrollNumber(grossSalary) ?? 0;
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
  const salary = toPayrollNumber(grossSalary) ?? 0;
  let totalDeductions = 0;
  const breakdown = [];

  deductions.forEach(deduction => {
    if (!deduction) return;

    const name = deduction.name || 'Custom Deduction';

    let pct =
      deduction.percentage !== undefined && deduction.percentage !== null && deduction.percentage !== ''
        ? toPayrollNumber(deduction.percentage)
        : null;
    if (pct == null && deduction.type === 'percentage' && deduction.value !== undefined && deduction.value !== null) {
      pct = toPayrollNumber(deduction.value);
    }

    let fix =
      deduction.amount !== undefined && deduction.amount !== null && deduction.amount !== ''
        ? toPayrollNumber(deduction.amount)
        : null;
    if (fix == null && deduction.type === 'fixed' && deduction.value !== undefined && deduction.value !== null) {
      fix = toPayrollNumber(deduction.value);
    }
    if (fix == null && deduction.type === 'amount' && deduction.value !== undefined && deduction.value !== null) {
      fix = toPayrollNumber(deduction.value);
    }

    let amount = 0;
    let deductionType = 'fixed';

    // Positive percentage beats fixed when both are set (matches HR "percent vs lump sum" expectations).
    if (pct != null && !Number.isNaN(pct) && pct > 0) {
      amount = salary * (pct / 100);
      deductionType = 'percentage';
    } else if (fix != null && !Number.isNaN(fix)) {
      amount = fix;
      deductionType = 'fixed';
    }

    amount = roundMoney(amount);
    totalDeductions += amount;

    breakdown.push({
      name,
      type: deductionType,
      percentage: deductionType === 'percentage' ? pct : null,
      amount
    });
  });

  return {
    totalAmount: roundMoney(totalDeductions),
    breakdown
  };
}

/**
 * Calculate complete payroll based on selected deductions.
 * Pass **contractual gross salary** only; cash benefits/allowances meant to be paid after tax
 * should be added by callers to the returned `netPay` (see payroll POST and HR edit flow).
 */
export function calculatePayroll(grossSalary, selectedDeductions = [], options = {}) {
  const salary = toPayrollNumber(grossSalary) ?? 0;
  
  const hasPAYE = selectedDeductions.some(deductionMatchesPaye);
  const hasNPS = selectedDeductions.some(deductionMatchesNps);

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

  // PAYE and employee NPS are separate statutory deductions from gross.
  const payeTaxableBase = Math.max(0, salary);
  let payeCalculation = { payeAmount: 0, breakdown: [] };
  if (hasPAYE) {
    payeCalculation = calculatePAYE(payeTaxableBase);
  }
  
  const customDeductions = selectedDeductions.filter(
    (d) => !deductionMatchesPaye(d) && !deductionMatchesNps(d),
  );
  const customDeductionsCalculation = calculateCustomDeductions(salary, customDeductions);
  
  // Calculate net pay
  const totalDeductions = payeCalculation.payeAmount + npsCalculation.employeeAmount + customDeductionsCalculation.totalAmount;
  const netPay = salary - totalDeductions;

  return {
    grossSalary: salary,
    /** Monthly gross income used for PAYE brackets. */
    payeTaxableIncome: hasPAYE ? payeTaxableBase : 0,
    paye: payeCalculation,
    nps: npsCalculation,
    /** Percentage points actually used for NPS (tenant custom or statutory default when unset). */
    npsRatesApplied: {
      employeeRatePercent: hasNPS ? employeeRatePercent : 0,
      employerRatePercent: hasNPS ? employerRatePercent : 0,
    },
    customDeductions: customDeductionsCalculation,
    totalDeductions: roundMoney(totalDeductions),
    netPay: roundMoney(netPay),
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
