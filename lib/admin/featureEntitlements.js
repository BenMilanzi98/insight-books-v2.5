/**
 * Platform feature entitlement helpers — plan inheritance vs tenant override.
 * Disabling a feature must not delete tenant data.
 */

export const ENTITLEMENT_SOURCES = {
  PLAN: 'PLAN',
  TENANT_OVERRIDE: 'TENANT_OVERRIDE',
  TRIAL: 'TRIAL',
  COMPLIANCE: 'COMPLIANCE',
  BETA: 'BETA',
};

export const ENTITLEMENT_STATUSES = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
  EXPIRED: 'EXPIRED',
  PENDING: 'PENDING',
};

/**
 * Resolve effective entitlement: explicit tenant override wins over plan.
 */
export function resolveEffectiveEntitlement({ planEnabled, override }) {
  if (override && override.status === ENTITLEMENT_STATUSES.DISABLED) {
    return {
      enabled: false,
      source: ENTITLEMENT_SOURCES.TENANT_OVERRIDE,
      reason: override.reason || 'Tenant override disabled',
      readOnlyHistorical: true,
    };
  }
  if (override && override.status === ENTITLEMENT_STATUSES.ACTIVE) {
    const expired =
      override.endDate && new Date(override.endDate).getTime() < Date.now();
    if (expired) {
      return {
        enabled: false,
        source: ENTITLEMENT_SOURCES.TENANT_OVERRIDE,
        reason: 'Override expired',
        readOnlyHistorical: true,
      };
    }
    return {
      enabled: true,
      source: ENTITLEMENT_SOURCES.TENANT_OVERRIDE,
      reason: override.reason || null,
      readOnlyHistorical: false,
    };
  }
  return {
    enabled: Boolean(planEnabled),
    source: ENTITLEMENT_SOURCES.PLAN,
    reason: null,
    readOnlyHistorical: !planEnabled,
  };
}

export function validateEntitlementWrite({ featureCode, tenantId, status }) {
  if (!featureCode || !String(featureCode).trim()) {
    return { ok: false, error: 'featureCode is required' };
  }
  if (!tenantId) {
    return { ok: false, error: 'tenantId is required' };
  }
  if (status && !Object.values(ENTITLEMENT_STATUSES).includes(status)) {
    return { ok: false, error: 'Invalid entitlement status' };
  }
  return { ok: true };
}
