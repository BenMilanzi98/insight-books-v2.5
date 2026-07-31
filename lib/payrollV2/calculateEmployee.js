import {
  addMoney,
  parseMoney,
  percentOfMoney,
  roundMoney,
  subtractMoney,
} from '@/lib/money';
import { calculatePAYE, calculateNPS, calculateCustomDeductions } from '@/lib/payrollCalculations';
import { deductionMatchesNps, deductionMatchesPaye } from '@/lib/payrollDeductionMatching';
import { DEFAULT_MIN_NET_PAY } from './calculationOrder.js';
import { COMPONENT_CATEGORY } from './constants.js';

/**
 * Calculate one employee from snapshot row + options (NPS rates, PAYE fn, min net).
 */
/** Async wrapper when calculatePaye returns a Promise (tenant tax config). */
export async function calculateEmployeePayrollV2Async(snapshotEmployee, options = {}) {
  const opts = { ...options };
  if (typeof opts.calculatePaye === 'function') {
    const original = opts.calculatePaye;
    opts.calculatePaye = (taxable) => {
      const result = original(taxable);
      if (result && typeof result.then === 'function') {
        throw new Error('Internal: pre-resolve PAYE before sync calculator');
      }
      return result;
    };
    // Pre-compute taxable base for PAYE resolve
    const compensation = snapshotEmployee.compensation || {};
    let basic = parseMoney(compensation.basicSalary ?? compensation.grossSalary ?? 0);
    const hourlyRate = parseMoney(compensation.hourlyRate ?? 0);
    const approvedHours = Number(snapshotEmployee.attendance?.approvedHours || 0);
    if ((compensation.payBasis || 'MONTHLY_SALARY') === 'HOURLY_RATE' && hourlyRate > 0) {
      basic = roundMoney(hourlyRate * approvedHours);
    }
    const otMult = parseMoney(compensation.overtimeMultiplier ?? 1.5) || 1.5;
    const approvedOtHours = Number(snapshotEmployee.attendance?.approvedOtHours || 0);
    let overtimePay = 0;
    if (approvedOtHours > 0) {
      const baseHourly =
        hourlyRate > 0 ? hourlyRate : basic > 0 ? roundMoney(basic / 160) : 0;
      overtimePay = roundMoney(baseHourly * otMult * approvedOtHours);
    }
    let taxableBenefits = 0;
    for (const b of snapshotEmployee.benefits || []) {
      if (b.isTaxable) taxableBenefits = addMoney(taxableBenefits, parseMoney(b.amount));
    }
    const taxablePay = addMoney(basic, overtimePay, taxableBenefits);
    const paye = await original(taxablePay);
    opts.calculatePaye = () => paye;
  }
  return calculateEmployeePayrollV2(snapshotEmployee, opts);
}

export function calculateEmployeePayrollV2(snapshotEmployee, options = {}) {
  const explanation = { steps: [] };
  const components = [];
  const compensation = snapshotEmployee.compensation || {};
  const payBasis = compensation.payBasis || 'MONTHLY_SALARY';

  let basic = parseMoney(compensation.basicSalary ?? compensation.grossSalary ?? 0);
  const hourlyRate = parseMoney(compensation.hourlyRate ?? 0);
  const otMult = parseMoney(compensation.overtimeMultiplier ?? 1.5) || 1.5;
  const approvedHours = Number(snapshotEmployee.attendance?.approvedHours || 0);
  const approvedOtHours = Number(snapshotEmployee.attendance?.approvedOtHours || 0);

  if (payBasis === 'HOURLY_RATE' && hourlyRate > 0) {
    basic = roundMoney(hourlyRate * approvedHours);
    explanation.steps.push({
      step: 'compute_basic_earnings',
      detail: `Hourly ${hourlyRate} × ${approvedHours}h = ${basic}`,
    });
  } else {
    explanation.steps.push({
      step: 'compute_basic_earnings',
      detail: `Monthly/contract basic ${basic}`,
    });
  }

  let overtimePay = 0;
  if (approvedOtHours > 0) {
    const baseHourly =
      hourlyRate > 0 ? hourlyRate : basic > 0 ? roundMoney(basic / 160) : 0;
    overtimePay = roundMoney(baseHourly * otMult * approvedOtHours);
    explanation.steps.push({
      step: 'resolve_approved_attendance_ot',
      detail: `OT ${approvedOtHours}h × ${baseHourly} × ${otMult} = ${overtimePay}`,
    });
  }

  components.push({
    code: 'BASIC',
    name: 'Basic Salary',
    category: COMPONENT_CATEGORY.EARNING,
    amount: basic,
    isCredit: false,
    sortOrder: 10,
  });
  if (overtimePay > 0) {
    components.push({
      code: 'OT',
      name: 'Overtime',
      category: COMPONENT_CATEGORY.EARNING,
      amount: overtimePay,
      isCredit: false,
      sortOrder: 20,
    });
  }

  let taxableBenefits = 0;
  let nonTaxableBenefits = 0;
  for (const b of snapshotEmployee.benefits || []) {
    const amt = parseMoney(b.amount);
    if (!amt) continue;
    if (b.isTaxable) taxableBenefits = addMoney(taxableBenefits, amt);
    else nonTaxableBenefits = addMoney(nonTaxableBenefits, amt);
    components.push({
      code: `BEN_${b.benefitId || b.id}`,
      name: b.name || 'Benefit',
      category: COMPONENT_CATEGORY.EARNING,
      amount: amt,
      isCredit: false,
      sortOrder: 30,
      meta: { taxable: !!b.isTaxable },
    });
  }

  const grossPay = addMoney(basic, overtimePay, taxableBenefits, nonTaxableBenefits);
  const taxablePay = addMoney(basic, overtimePay, taxableBenefits);
  explanation.steps.push({
    step: 'compute_gross_and_taxable',
    detail: `Gross ${grossPay}, taxable ${taxablePay}`,
  });

  // Deductions source: assignments first, else legacy selectedDeductions
  let selected = snapshotEmployee.deductionAssignments?.length
    ? snapshotEmployee.deductionAssignments
    : Array.isArray(snapshotEmployee.selectedDeductions)
      ? snapshotEmployee.selectedDeductions
      : [];

  const hasPAYE =
    options.applyPaye !== false &&
    (selected.some(deductionMatchesPaye) || options.forcePaye);
  const hasNPS =
    options.applyNps !== false &&
    (selected.some(deductionMatchesNps) || options.forceNps) &&
    compensation.pensionEligible !== false;

  let nps = {
    employeeAmount: 0,
    employerAmount: 0,
    totalAmount: 0,
    employeeRatePercent: 0,
    employerRatePercent: 0,
  };
  if (hasNPS) {
    nps = calculateNPS(
      taxablePay,
      options.npsEmployeeRatePercent ?? 5,
      options.npsEmployerRatePercent ?? 10
    );
    explanation.steps.push({
      step: 'compute_employee_nps',
      detail: `Employee NPS ${nps.employeeAmount}`,
    });
    components.push({
      code: 'NPS_EE',
      name: 'NPS Employee',
      category: COMPONENT_CATEGORY.DEDUCTION,
      amount: nps.employeeAmount,
      isCredit: false,
      sortOrder: 50,
    });
    components.push({
      code: 'NPS_ER',
      name: 'NPS Employer',
      category: COMPONENT_CATEGORY.EMPLOYER,
      amount: nps.employerAmount,
      isCredit: false,
      sortOrder: 55,
    });
  }

  let payeAmount = 0;
  let payeBreakdown = [];
  if (hasPAYE) {
    const payeFn = options.calculatePaye || calculatePAYE;
    const payeResult = payeFn(taxablePay);
    // Support async tenant PAYE resolvers
    if (payeResult && typeof payeResult.then === 'function') {
      throw new Error(
        'calculateEmployeePayrollV2 received async PAYE; use calculateEmployeePayrollV2Async'
      );
    }
    const paye = payeResult;
    payeAmount = parseMoney(paye.payeAmount);
    payeBreakdown = paye.breakdown || [];
    explanation.steps.push({
      step: 'compute_paye',
      detail: `PAYE ${payeAmount}`,
    });
    components.push({
      code: 'PAYE',
      name: 'PAYE',
      category: COMPONENT_CATEGORY.DEDUCTION,
      amount: payeAmount,
      isCredit: false,
      sortOrder: 60,
      meta: { breakdown: payeBreakdown },
    });
  }

  const otherSelected = selected
    .filter((d) => !deductionMatchesPaye(d) && !deductionMatchesNps(d))
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  const custom = calculateCustomDeductions(taxablePay, otherSelected);
  let otherDeductions = parseMoney(custom.totalAmount);
  for (const row of custom.breakdown || []) {
    components.push({
      code: `DED_${(row.name || 'X').replace(/\s+/g, '_').toUpperCase()}`,
      name: row.name,
      category: COMPONENT_CATEGORY.DEDUCTION,
      amount: parseMoney(row.amount),
      isCredit: false,
      sortOrder: 70 + (row.priority || 0),
    });
  }
  explanation.steps.push({
    step: 'apply_other_deductions_by_priority',
    detail: `Other deductions ${otherDeductions}`,
  });

  let advanceRecovery = 0;
  for (const adv of snapshotEmployee.advances || []) {
    const due = Math.min(
      parseMoney(adv.monthlyDeduction),
      parseMoney(adv.outstandingAmount)
    );
    if (due > 0) {
      advanceRecovery = addMoney(advanceRecovery, due);
      components.push({
        code: `ADV_${adv.id}`,
        name: 'Advance Recovery',
        category: COMPONENT_CATEGORY.DEDUCTION,
        amount: due,
        isCredit: false,
        sortOrder: 80,
        meta: { advanceId: adv.id },
      });
    }
  }
  explanation.steps.push({
    step: 'apply_advance_recovery',
    detail: `Advance recovery ${advanceRecovery}`,
  });

  let penaltyTotal = 0;
  for (const p of snapshotEmployee.penalties || []) {
    const amt = parseMoney(p.amount);
    if (amt > 0) {
      penaltyTotal = addMoney(penaltyTotal, amt);
      components.push({
        code: `PEN_${p.id}`,
        name: 'Disciplinary Penalty',
        category: COMPONENT_CATEGORY.DEDUCTION,
        amount: amt,
        isCredit: false,
        sortOrder: 85,
        meta: { penaltyId: p.id },
      });
    }
  }

  const totalEmployeeDeductions = addMoney(
    payeAmount,
    nps.employeeAmount,
    otherDeductions,
    advanceRecovery,
    penaltyTotal
  );
  let netPay = subtractMoney(grossPay, totalEmployeeDeductions);

  const minNet = parseMoney(options.minNetPay ?? DEFAULT_MIN_NET_PAY);
  if (netPay < minNet) {
    // Defer advance recovery first to protect min net
    const shortfall = subtractMoney(minNet, netPay);
    if (advanceRecovery > 0 && shortfall > 0) {
      const reduce = Math.min(advanceRecovery, shortfall);
      advanceRecovery = subtractMoney(advanceRecovery, reduce);
      netPay = addMoney(netPay, reduce);
      explanation.steps.push({
        step: 'enforce_min_net_pay',
        detail: `Deferred advance recovery ${reduce} to keep min net ${minNet}`,
      });
      // update ADV components
      let remainingReduce = reduce;
      for (const c of components) {
        if (c.code.startsWith('ADV_') && remainingReduce > 0) {
          const cut = Math.min(c.amount, remainingReduce);
          c.amount = subtractMoney(c.amount, cut);
          remainingReduce = subtractMoney(remainingReduce, cut);
        }
      }
    }
  }

  const gratuityRate = parseMoney(options.gratuityRatePercent ?? 0);
  const gratuityAccrual =
    compensation.gratuityEligible === false
      ? 0
      : percentOfMoney(basic, gratuityRate);

  if (gratuityAccrual > 0) {
    components.push({
      code: 'GRATUITY',
      name: 'Gratuity Accrual',
      category: COMPONENT_CATEGORY.EMPLOYER,
      amount: gratuityAccrual,
      isCredit: false,
      sortOrder: 90,
    });
  }

  explanation.steps.push({
    step: 'build_components_and_explanation',
    detail: `Net ${netPay}`,
  });

  return {
    employeeId: snapshotEmployee.employeeId,
    grossPay: roundMoney(grossPay),
    taxablePay: roundMoney(taxablePay),
    payeAmount: roundMoney(payeAmount),
    npsEmployee: roundMoney(nps.employeeAmount),
    npsEmployer: roundMoney(nps.employerAmount),
    otherDeductions: roundMoney(otherDeductions),
    advanceRecovery: roundMoney(advanceRecovery),
    penaltyTotal: roundMoney(penaltyTotal),
    gratuityAccrual: roundMoney(gratuityAccrual),
    netPay: roundMoney(netPay),
    components: components.filter((c) => parseMoney(c.amount) !== 0),
    explanation,
  };
}
