/**
 * Server-side projection of admin dashboard stats by metric permissions.
 */

import { authorizeAdminDecision } from './authorizeAdminDecision.js';
import { AUTHZ_OUTCOMES } from './outcomes.js';
import { SYSTEM_ADMIN_PERMISSIONS } from '../permissions.js';

/**
 * @param {object} admin
 * @param {object} stats
 * @returns {{ stats: object, decisions: object }}
 */
export function projectDashboardStats(admin, stats) {
  const view = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.dashboard.view,
  });
  if (!view.allowed) {
    return { stats: null, decisions: { view }, denied: true };
  }

  const financial = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.dashboard.financialMetrics,
  });
  const security = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.dashboard.securityMetrics,
  });
  const operational = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.dashboard.operationalMetrics,
  });

  const out = { ...stats };

  if (!financial.allowed) {
    out.totalRevenue = null;
    out.monthlyRevenue = null;
    out.monthlyRecurringRevenue = null;
    out.saasKpis = null;
    out.financialMetrics = null;
    out.subscriptionAmounts = null;
    out.totalActiveSubscriptionRevenue = null;
    out.averageSubscriptionAmount = null;
    out.affiliateCommissions = null;
    out.revenueSource = 'redacted';
  } else if (financial.outcome === AUTHZ_OUTCOMES.ALLOW_MASKED) {
    out.saasKpis = out.saasKpis
      ? {
          estimatedMrr: out.saasKpis.estimatedMrr ?? null,
          paymentsCollectedThisPeriod: out.saasKpis.paymentsCollectedThisPeriod ?? null,
          distinctActivePaidTenants: out.saasKpis.distinctActivePaidTenants ?? null,
          masked: true,
        }
      : null;
    out.subscriptionAmounts = null;
    out.financialMetrics = out.financialMetrics
      ? {
          estimatedMrr: out.financialMetrics.estimatedMrr ?? null,
          paymentsCollectedThisPeriod: out.financialMetrics.paymentsCollectedThisPeriod ?? null,
          source: 'saas_billing_kpis_masked',
        }
      : null;
  }

  if (!security.allowed) {
    out.securityStatus = null;
  }

  if (!operational.allowed) {
    out.performanceMetrics = null;
    out.systemHealth = null;
  }

  // Tenant marketplace activity is not SaaS finance but still sensitive ops detail
  if (!operational.allowed && !financial.allowed) {
    out.tenantActivity = null;
  }

  return {
    stats: out,
    decisions: {
      view: view.outcome,
      financial: financial.outcome,
      security: security.outcome,
      operational: operational.outcome,
    },
    denied: false,
  };
}
