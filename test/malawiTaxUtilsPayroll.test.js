import { describe, it, expect } from 'vitest';
import {
  calculateMalawiPayroll,
  calculateStatutoryRemittances,
  generatePayrollJournalEntries,
} from '../lib/malawiTaxUtils.js';
import {
  calculatePayroll,
  calculateCustomDeductions,
  toPayrollNumber,
} from '../lib/payrollCalculations.js';
import { effectiveNpsRatePercentForPayroll } from '../lib/npsTenantRates.js';

const payeDeduction = { id: 'p1', name: 'PAYE', isStatutory: true };
const npsDeduction = { id: 'n1', name: 'NPS', isStatutory: true };

describe('effectiveNpsRatePercentForPayroll', () => {
  it('returns tenant custom rate when finite', () => {
    expect(effectiveNpsRatePercentForPayroll(3.5, true)).toBe(3.5);
    expect(effectiveNpsRatePercentForPayroll('4', true)).toBe(4);
  });
  it('returns statutory default when unset and NPS selected', () => {
    expect(effectiveNpsRatePercentForPayroll(null, true)).toBe(5);
    expect(effectiveNpsRatePercentForPayroll(undefined, true)).toBe(5);
  });
  it('allows explicit zero', () => {
    expect(effectiveNpsRatePercentForPayroll(0, true)).toBe(0);
  });
  it('returns zero when NPS not selected', () => {
    expect(effectiveNpsRatePercentForPayroll(null, false)).toBe(0);
  });
});

describe('calculateMalawiPayroll — PAYE and NPS as separate gross-based deductions', () => {
  it('calculates PAYE and employee NPS separately from gross when both apply', () => {
    const gross = 500_000;
    const payeOnly = calculateMalawiPayroll(
      { basicSalary: gross, allowances: {}, otherDeductions: {} },
      true,
      false,
      null,
    );
    const payeAndNps = calculateMalawiPayroll(
      { basicSalary: gross, allowances: {}, otherDeductions: {} },
      true,
      true,
      { employeeRatePercent: 5, employerRatePercent: 5 },
    );

    expect(payeOnly.payeAmount).toBe(99_000);
    expect(payeAndNps.payeTaxableIncome).toBe(500_000);
    expect(payeAndNps.payeAmount).toBe(99_000);
    expect(payeAndNps.payeAmount).toBe(payeOnly.payeAmount);
    expect(payeAndNps.npsEmployeeAmount).toBe(25_000);
  });

  it('uses custom NPS % from tenant rates without reducing the PAYE base', () => {
    const gross = 1_000_000;
    const r = calculateMalawiPayroll(
      { basicSalary: gross, allowances: {}, otherDeductions: {} },
      true,
      true,
      { employeeRatePercent: 2.5, employerRatePercent: 6 },
    );
    expect(r.npsRatesApplied).toEqual({
      employeeRatePercent: 2.5,
      employerRatePercent: 6,
    });
    expect(r.npsEmployeeAmount).toBe(25_000);
    expect(r.payeTaxableIncome).toBe(1_000_000);
  });

  it('PAYE without NPS still uses full gross as taxable income', () => {
    const r = calculateMalawiPayroll(
      { basicSalary: 500_000, allowances: {}, otherDeductions: {} },
      true,
      false,
      null,
    );
    expect(r.payeTaxableIncome).toBe(500_000);
    expect(r.payeAmount).toBe(99_000);
  });

  it('excludes allowances from PAYE/NPS base but adds them to net pay', () => {
    const withAllow = calculateMalawiPayroll(
      { basicSalary: 500_000, allowances: { housing: 100_000 }, otherDeductions: {} },
      true,
      true,
      { employeeRatePercent: 5, employerRatePercent: 5 },
    );
    const noAllow = calculateMalawiPayroll(
      { basicSalary: 500_000, allowances: {}, otherDeductions: {} },
      true,
      true,
      { employeeRatePercent: 5, employerRatePercent: 5 },
    );
    expect(withAllow.payeAmount).toBe(noAllow.payeAmount);
    expect(withAllow.npsEmployeeAmount).toBe(noAllow.npsEmployeeAmount);
    expect(withAllow.netPay).toBe(noAllow.netPay + 100_000);
  });

  it('accumulates PAYE, NPS, other deductions, and benefits exactly once', () => {
    const r = calculateMalawiPayroll(
      {
        basicSalary: 500_000,
        allowances: { housing: 100_000 },
        otherDeductions: { loan: 10_000 },
      },
      true,
      true,
      { employeeRatePercent: 5, employerRatePercent: 5 },
    );

    expect(r.grossPay).toBe(500_000);
    expect(r.totalAllowances).toBe(100_000);
    expect(r.npsEmployeeAmount).toBe(25_000);
    expect(r.payeTaxableIncome).toBe(500_000);
    expect(r.payeAmount).toBe(99_000);
    expect(r.totalDeductions).toBe(134_000);
    expect(r.netPay).toBe(466_000);
  });

  it('balances generated journal entries when benefits and employer NPS are present', () => {
    const payroll = calculateMalawiPayroll(
      {
        basicSalary: 500_000,
        allowances: { housing: 100_000 },
        otherDeductions: {},
      },
      true,
      true,
      { employeeRatePercent: 5, employerRatePercent: 5 },
    );

    const entries = generatePayrollJournalEntries(payroll, 'tenant-1');
    const debit = entries.reduce((sum, entry) => sum + entry.debit, 0);
    const credit = entries.reduce((sum, entry) => sum + entry.credit, 0);

    expect(debit).toBe(625_000);
    expect(credit).toBe(625_000);
  });

  it('reports posted NPS split from payroll notes, including non-5/5 tenant rates', () => {
    const remittances = calculateStatutoryRemittances([
      {
        payeAmount: 99_000,
        totalNpsAmount: 60_000,
        status: 'Posted',
        notes: JSON.stringify({
          npsEmployeeAmount: 25_000,
          npsEmployerAmount: 35_000,
          npsEmployeeRatePercent: 5,
          npsEmployerRatePercent: 7,
        }),
      },
    ]);

    expect(remittances.paye.amount).toBe(99_000);
    expect(remittances.nps.employeeAmount).toBe(25_000);
    expect(remittances.nps.employerAmount).toBe(35_000);
    expect(remittances.nps.totalAmount).toBe(60_000);
  });

  it('splits legacy total NPS by configured fallback rates when split is missing', () => {
    const remittances = calculateStatutoryRemittances(
      [
        {
          payeAmount: 0,
          totalNpsAmount: 120_000,
          status: 'Posted',
          notes: null,
        },
      ],
      { npsEmployeeRatePercent: 5, npsEmployerRatePercent: 7 },
    );

    expect(remittances.nps.employeeAmount).toBe(50_000);
    expect(remittances.nps.employerAmount).toBe(70_000);
    expect(remittances.nps.totalAmount).toBe(120_000);
  });
});

describe('toPayrollNumber', () => {
  it('parses comma-separated decimals', () => {
    expect(toPayrollNumber('200,999.82')).toBe(200999.82);
    expect(toPayrollNumber(' 100,000 ')).toBe(100000);
  });
});

describe('calculateCustomDeductions', () => {
  it('uses Prisma-style percentage on gross', () => {
    const r = calculateCustomDeductions(1_000_000, [
      { name: 'Loan', percentage: 17.5, amount: null },
    ]);
    expect(r.totalAmount).toBe(175000);
    expect(r.breakdown[0].type).toBe('percentage');
  });

  it('prefers positive percentage over fixed amount when both set', () => {
    const r = calculateCustomDeductions(200_000, [
      { name: 'Mixed', percentage: 10, amount: 50_000 },
    ]);
    expect(r.totalAmount).toBe(20_000);
  });

  it('uses fixed amount when percentage is zero or absent', () => {
    const r = calculateCustomDeductions(500_000, [{ name: 'Flat', percentage: 0, amount: 12_345.67 }]);
    expect(r.totalAmount).toBe(12345.67);
  });

  it('supports legacy type/value payloads', () => {
    const r = calculateCustomDeductions(800_000, [
      { name: 'Legacy %', type: 'percentage', value: '5' },
      { name: 'Legacy fix', type: 'fixed', value: 1000 },
    ]);
    expect(r.totalAmount).toBe(40_000 + 1_000);
  });
});

describe('calculatePayroll — PAYE and NPS as separate gross-based deductions', () => {
  it('calculates combined statutory deductions separately from gross', () => {
    const gross = 500_000;
    const calc = calculatePayroll(gross, [payeDeduction, npsDeduction], {
      npsEmployeeRatePercent: 5,
      npsEmployerRatePercent: 5,
    });
    expect(calc.payeTaxableIncome).toBe(500_000);
    expect(calc.paye.payeAmount).toBe(99_000);
    expect(calc.nps.employeeAmount).toBe(25_000);
  });

  it('uses custom tenant employee/employer % without reducing the PAYE base', () => {
    const gross = 1_000_000;
    const calc = calculatePayroll(gross, [payeDeduction, npsDeduction], {
      npsEmployeeRatePercent: 3,
      npsEmployerRatePercent: 7,
    });
    expect(calc.npsRatesApplied).toEqual({
      employeeRatePercent: 3,
      employerRatePercent: 7,
    });
    expect(calc.nps.employeeAmount).toBe(30_000);
    expect(calc.nps.employerAmount).toBe(70_000);
    expect(calc.payeTaxableIncome).toBe(1_000_000);
    expect(calc.paye.payeAmount).toBe(249_000);
  });

  it('defaults null tenant NPS to 5% each side when NPS applies (simple payroll API)', () => {
    const gross = 500_000;
    const calc = calculatePayroll(gross, [payeDeduction, npsDeduction], {
      npsEmployeeRatePercent: null,
      npsEmployerRatePercent: null,
    });
    expect(calc.npsRatesApplied).toEqual({
      employeeRatePercent: 5,
      employerRatePercent: 5,
    });
    expect(calc.nps.employeeAmount).toBe(25_000);
    expect(calc.payeTaxableIncome).toBe(500_000);
  });

  it('does not apply PAYE when only NPS plus an unrelated statutory row containing "tax"', () => {
    const unrelatedStatutory = {
      id: 'levy1',
      name: 'Statutory levy (tax component)',
      isStatutory: true,
    };
    const calc = calculatePayroll(
      550_000,
      [npsDeduction, unrelatedStatutory],
      { npsEmployeeRatePercent: 5, npsEmployerRatePercent: 5 },
    );
    expect(calc.paye.payeAmount).toBe(0);
    expect(calc.nps.employeeAmount).toBe(27_500);
    expect(calc.netPay).toBe(522_500);
  });

  it('550k gross with PAYE + NPS: PAYE and NPS both use gross as their base', () => {
    const calc = calculatePayroll(
      550_000,
      [payeDeduction, npsDeduction],
      { npsEmployeeRatePercent: 5, npsEmployerRatePercent: 5 },
    );
    expect(calc.payeTaxableIncome).toBe(550_000);
    expect(calc.paye.payeAmount).toBe(114_000);
    expect(calc.nps.employeeAmount).toBe(27_500);
    expect(calc.totalDeductions).toBe(141_500);
    expect(calc.netPay).toBe(408_500);
  });
});
