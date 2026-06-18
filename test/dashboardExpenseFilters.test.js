import { describe, it, expect } from 'vitest';
import {
  settledExpensePaymentOr,
  excludePayrollDashboardMirrorExpenses,
} from '../lib/dashboardExpenseFilters.js';
import { PAYROLL_DASHBOARD_EXPENSE_PREFIX } from '../lib/incomeStatementExpenseDedup.js';

describe('dashboardExpenseFilters', () => {
  it('settledExpensePaymentOr includes paid and partially paid rows', () => {
    const clause = settledExpensePaymentOr();
    expect(clause.OR).toBeDefined();
    expect(clause.OR.length).toBeGreaterThan(0);
  });

  it('excludePayrollDashboardMirrorExpenses filters payroll mirror notes', () => {
    const clause = excludePayrollDashboardMirrorExpenses();
    expect(clause.NOT.notes.contains).toBe(PAYROLL_DASHBOARD_EXPENSE_PREFIX);
  });

  it('excludePayrollDashboardMirrorExpenses returns a Prisma-compatible NOT shape', () => {
    const clause = excludePayrollDashboardMirrorExpenses();

    expect(clause).toEqual({
      NOT: {
        notes: { contains: PAYROLL_DASHBOARD_EXPENSE_PREFIX },
      },
    });
    expect(Object.keys(clause)).toEqual(['NOT']);
    expect(Object.keys(clause.NOT)).toEqual(['notes']);
    expect(clause.NOT.notes).toEqual({ contains: PAYROLL_DASHBOARD_EXPENSE_PREFIX });
  });

  it('excludePayrollDashboardMirrorExpenses spreads into expense where without clobbering siblings', () => {
    const tenantWhere = {
      tenantId: 'tenant-1',
      deletedAt: null,
      ...excludePayrollDashboardMirrorExpenses(),
    };

    expect(tenantWhere).toMatchObject({
      tenantId: 'tenant-1',
      deletedAt: null,
      NOT: {
        notes: { contains: PAYROLL_DASHBOARD_EXPENSE_PREFIX },
      },
    });
  });
});
