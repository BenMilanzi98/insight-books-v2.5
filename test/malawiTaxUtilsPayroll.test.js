import { describe, it, expect } from 'vitest';
import { calculateMalawiPayroll } from '../lib/malawiTaxUtils.js';
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

describe('calculateMalawiPayroll — PAYE on taxable income after NPS', () => {
  it('subtracts employee NPS from gross before PAYE when both apply', () => {
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
    expect(payeAndNps.payeTaxableIncome).toBe(475_000);
    // (475_000 − 170_000) × 30% = 91,500
    expect(payeAndNps.payeAmount).toBe(91_500);
    expect(payeAndNps.payeAmount).toBeLessThan(payeOnly.payeAmount);
    expect(payeAndNps.npsEmployeeAmount).toBe(25_000);
  });

  it('uses custom NPS % from tenant rates for employee amount and PAYE base', () => {
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
    expect(r.payeTaxableIncome).toBe(975_000);
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

describe('calculatePayroll — PAYE base after NPS', () => {
  it('matches Malawi taxable-income rule for combined statutory deductions', () => {
    const gross = 500_000;
    const calc = calculatePayroll(gross, [payeDeduction, npsDeduction], {
      npsEmployeeRatePercent: 5,
      npsEmployerRatePercent: 5,
    });
    expect(calc.payeTaxableIncome).toBe(475_000);
    expect(calc.paye.payeAmount).toBe(91_500);
    expect(calc.nps.employeeAmount).toBe(25_000);
  });

  it('uses custom tenant employee/employer % for amounts and PAYE base', () => {
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
    expect(calc.payeTaxableIncome).toBe(970_000);
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
    expect(calc.payeTaxableIncome).toBe(475_000);
  });
});
