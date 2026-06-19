import { describe, it, expect } from 'vitest';
import { payrollToPayeSummaryRow } from '../lib/payrollEngine/payeSummaryService.js';

describe('payrollToPayeSummaryRow', () => {
  it('derives totals from stored payroll fields', () => {
    const payroll = {
      id: 'pay-1',
      tenantId: 'tenant-1',
      employeeId: 'emp-1',
      basicSalary: 500000,
      grossPay: 550000,
      additions: 50000,
      deductions: 120000,
      payeAmount: 75000,
      totalNpsAmount: 27500,
      netPay: 430000,
      status: 'Processed',
      periodStart: new Date('2026-05-01'),
      periodEnd: new Date('2026-05-31'),
      paymentDate: new Date('2026-06-05'),
      notes: JSON.stringify({
        payeTaxableIncome: 540000,
        allowances: { Housing: 50000 },
        totalAdvanceDeductions: 10000,
        totalLeaveDeductions: 0,
      }),
      employee: {
        name: 'Jane Doe',
        employeeId: 'EMP001',
        department: 'Finance',
        workLocation: 'Blantyre',
      },
    };

    const row = payrollToPayeSummaryRow(payroll, {
      npsEmployeeRatePercent: 5,
      npsEmployerRatePercent: 5,
      journalPosted: true,
    });

    expect(row.employeeName).toBe('Jane Doe');
    expect(row.basicSalary).toBe(500000);
    expect(row.grossPay).toBe(550000);
    expect(row.taxableIncome).toBe(540000);
    expect(row.payeDeducted).toBe(75000);
    expect(row.advanceRecovery).toBe(10000);
    expect(row.journalStatus).toBe('Posted');
    expect(row.isProvisional).toBe(false);
  });

  it('marks draft payroll as provisional', () => {
    const payroll = {
      id: 'pay-2',
      employeeId: 'emp-2',
      basicSalary: 200000,
      grossPay: 200000,
      deductions: 20000,
      payeAmount: 15000,
      totalNpsAmount: 5000,
      netPay: 180000,
      status: 'Pending',
      notes: null,
      employee: { name: 'John Smith', employeeId: 'EMP002' },
    };

    const row = payrollToPayeSummaryRow(payroll, {});
    expect(row.isProvisional).toBe(true);
    expect(row.journalStatus).toBe('Not posted');
  });

  it('zeroes net pay for reversed payroll', () => {
    const payroll = {
      id: 'pay-3',
      employeeId: 'emp-3',
      basicSalary: 300000,
      grossPay: 300000,
      deductions: 50000,
      payeAmount: 30000,
      totalNpsAmount: 10000,
      netPay: 250000,
      status: 'Reversed',
      notes: null,
      employee: { name: 'Reversed Emp', employeeId: 'EMP003' },
    };

    const row = payrollToPayeSummaryRow(payroll, { journalReversed: true });
    expect(row.netPay).toBe(0);
    expect(row.journalStatus).toBe('Reversed');
  });
});
