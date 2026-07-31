import { describe, expect, it } from 'vitest';
import { calculateEmployeePayrollV2 } from '../lib/payrollV2/calculateEmployee.js';

describe('payrollV2 calculateEmployee', () => {
  it('computes monthly basic with PAYE and NPS', () => {
    const result = calculateEmployeePayrollV2(
      {
        employeeId: 'e1',
        compensation: {
          payBasis: 'MONTHLY_SALARY',
          basicSalary: 500000,
          pensionEligible: true,
          gratuityEligible: false,
        },
        attendance: { approvedHours: 160, approvedOtHours: 0 },
        benefits: [],
        advances: [],
        penalties: [],
        selectedDeductions: [{ name: 'PAYE' }, { name: 'NPS' }],
      },
      {
        npsEmployeeRatePercent: 5,
        npsEmployerRatePercent: 10,
        forcePaye: true,
        forceNps: true,
        calculatePaye: () => ({ payeAmount: 25000, breakdown: [] }),
      }
    );

    expect(result.grossPay).toBe(500000);
    expect(result.payeAmount).toBe(25000);
    expect(result.npsEmployee).toBe(25000);
    expect(result.npsEmployer).toBe(50000);
    expect(result.netPay).toBe(450000);
    expect(result.components.some((c) => c.code === 'BASIC')).toBe(true);
    expect(result.explanation.steps.length).toBeGreaterThan(3);
  });

  it('includes approved OT only', () => {
    const result = calculateEmployeePayrollV2(
      {
        employeeId: 'e2',
        compensation: {
          payBasis: 'MONTHLY_SALARY',
          basicSalary: 160000,
          hourlyRate: 1000,
          overtimeMultiplier: 1.5,
          pensionEligible: false,
        },
        attendance: { approvedHours: 160, approvedOtHours: 10 },
        benefits: [],
        advances: [],
        penalties: [],
        selectedDeductions: [],
      },
      { forcePaye: false, forceNps: false }
    );
    // OT = 1000 * 1.5 * 10 = 15000
    expect(result.grossPay).toBe(175000);
    expect(result.components.some((c) => c.code === 'OT')).toBe(true);
  });

  it('recovers advances and enforces min net by deferring recovery', () => {
    const result = calculateEmployeePayrollV2(
      {
        employeeId: 'e3',
        compensation: { basicSalary: 100000, pensionEligible: false },
        attendance: { approvedHours: 0, approvedOtHours: 0 },
        benefits: [],
        advances: [{ id: 'a1', monthlyDeduction: 90000, outstandingAmount: 90000 }],
        penalties: [],
        selectedDeductions: [],
      },
      { forcePaye: false, forceNps: false, minNetPay: 50000 }
    );
    expect(result.netPay).toBeGreaterThanOrEqual(50000);
    expect(result.advanceRecovery).toBeLessThanOrEqual(50000);
  });
});
