import { getSubscriptionStatusFromSubscriptions } from '@/lib/subscriptionService';

export function normalizeTenantStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'active') return 'active';
  if (s === 'suspended') return 'suspended';
  if (s === 'archived') return 'archived';
  return s || 'active';
}

export function isTenantLifecycleActive(status) {
  return normalizeTenantStatus(status) === 'active';
}

/**
 * Non-trial subscription with payment evidence.
 */
export function subscriptionIndicatesPaid(sub) {
  if (!sub || sub.isTrial === true) return false;
  if (sub.paymentDate != null) return true;
  if (Number(sub.amount) > 0) return true;
  if (sub.expiresAt != null) return true;
  const st = String(sub.status || '').toLowerCase();
  if (['completed', 'active', 'paid'].includes(st)) return true;
  return false;
}

export function tenantPaidBefore(subscriptions) {
  const subs = Array.isArray(subscriptions) ? subscriptions : [];
  return subs.some(subscriptionIndicatesPaid);
}

/**
 * @param {{ status?: string, accountSubscriptions?: array }} tenant
 * @param {Date} [now]
 */
export function classifyTenantIdentity(tenant, now = new Date()) {
  const subs = Array.isArray(tenant?.accountSubscriptions) ? tenant.accountSubscriptions : [];
  const subscriptionStatus = getSubscriptionStatusFromSubscriptions(subs, now);
  const paidBefore = tenantPaidBefore(subs);
  const lifecycleActive = isTenantLifecycleActive(tenant?.status);
  const isPaidActive = subscriptionStatus === 'active' && lifecycleActive;
  const isPaidInactive = paidBefore && !isPaidActive;
  return {
    subscriptionStatus,
    paidBefore,
    lifecycleActive,
    isPaidActive,
    isPaidInactive,
  };
}

/**
 * @param {'active'|'paid_inactive'|'specific'} mode
 * @param {object} tenant
 * @param {{ tenantId?: string, subdomain?: string }} [specific]
 * @param {Date} [now]
 */
export function tenantMatchesExportFilter(mode, tenant, specific = {}, now = new Date()) {
  const c = classifyTenantIdentity(tenant, now);
  if (mode === 'active') return c.isPaidActive;
  if (mode === 'paid_inactive') return c.isPaidInactive;
  if (mode === 'specific') {
    const id = String(specific.tenantId || '').trim();
    const sub = String(specific.subdomain || '').trim().toLowerCase();
    if (id && tenant.id === id) return true;
    if (sub && String(tenant.subdomain || '').toLowerCase() === sub) return true;
    return false;
  }
  return false;
}
