import { describe, it, expect } from 'vitest';
import { projectDashboardStats } from '@/lib/admin/authorization/projectDashboardStats';
import { AUTHZ_OUTCOMES } from '@/lib/admin/authorization/outcomes';

const sample = {
  totalRevenue: 100,
  monthlyRecurringRevenue: 50,
  saasKpis: { estimatedMrr: 50, paymentsCollectedThisPeriod: 10, distinctActivePaidTenants: 2 },
  financialMetrics: { estimatedMrr: 50, paymentsCollectedThisPeriod: 10, source: 'saas_billing_kpis' },
  securityStatus: { firewall: 'protected' },
  performanceMetrics: { apiCalls: 1 },
  systemHealth: { database: 'online' },
  tenantActivity: { saleCount: 9 },
};

describe('projectDashboardStats', () => {
  it('redacts finance when only dashboard.view', () => {
    const { stats, decisions } = projectDashboardStats(
      {
        id: 'a1',
        role: 'Platform Support',
        permissions: { systemAdmin: { dashboard: { view: true } } },
      },
      sample
    );
    expect(decisions.financial).toBe(AUTHZ_OUTCOMES.ALLOW_MASKED);
    expect(stats.saasKpis.masked).toBe(true);
    expect(stats.subscriptionAmounts).toBeNull();
  });

  it('keeps finance for full financialMetrics grant', () => {
    const { stats, decisions } = projectDashboardStats(
      {
        id: 'a2',
        role: 'Billing Administrator',
        permissions: {
          systemAdmin: {
            dashboard: { view: true, financialMetrics: true },
          },
        },
      },
      sample
    );
    expect(decisions.financial).toBe(AUTHZ_OUTCOMES.ALLOW);
    expect(stats.totalRevenue).toBe(100);
    expect(stats.saasKpis.masked).toBeUndefined();
  });
});
