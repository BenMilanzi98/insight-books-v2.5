/**
 * Canonical Admin control-plane authorisation decision.
 * Default deny. Super Admin = break-glass ALLOW.
 */

import { AUTHZ_OUTCOMES, isAuthzAllowed } from './outcomes.js';
import {
  CATALOGUE_VERSION,
  isSuperAdminRole,
  MASKABLE_VIA_DASHBOARD_VIEW,
} from './catalogue.js';
import { adminJsonGrantsPermission } from './evaluateGrant.js';

const DASHBOARD_VIEW = 'systemAdmin.dashboard.view';

/**
 * @param {{
 *   admin?: object|null,
 *   permission?: string|null,
 *   resource?: string,
 *   action?: string,
 *   scope?: string,
 *   supportSession?: object|null,
 * }} input
 */
export function authorizeAdminDecision(input = {}) {
  const { admin, permission } = input;
  const base = {
    catalogueVersion: CATALOGUE_VERSION,
    permission: permission || null,
    breakGlass: false,
    reason: null,
  };

  if (!admin) {
    return {
      ...base,
      outcome: AUTHZ_OUTCOMES.DENY,
      allowed: false,
      reason: 'unauthenticated',
    };
  }

  if (admin.isActive === false) {
    return {
      ...base,
      outcome: AUTHZ_OUTCOMES.DENY,
      allowed: false,
      reason: 'inactive',
    };
  }

  if (!permission) {
    return {
      ...base,
      outcome: AUTHZ_OUTCOMES.DENY,
      allowed: false,
      reason: 'permission_required',
    };
  }

  if (isSuperAdminRole(admin.role)) {
    return {
      ...base,
      outcome: AUTHZ_OUTCOMES.ALLOW,
      allowed: true,
      breakGlass: true,
      reason: 'break_glass_super_admin',
    };
  }

  if (adminJsonGrantsPermission(admin, permission)) {
    return {
      ...base,
      outcome: AUTHZ_OUTCOMES.ALLOW,
      allowed: true,
      reason: 'grant',
    };
  }

  // Executive-style masked finance: dashboard.view without financialMetrics
  if (
    MASKABLE_VIA_DASHBOARD_VIEW.has(permission) &&
    adminJsonGrantsPermission(admin, DASHBOARD_VIEW)
  ) {
    return {
      ...base,
      outcome: AUTHZ_OUTCOMES.ALLOW_MASKED,
      allowed: true,
      reason: 'masked_via_dashboard_view',
    };
  }

  return {
    ...base,
    outcome: AUTHZ_OUTCOMES.DENY,
    allowed: false,
    reason: 'default_deny',
  };
}

export { isAuthzAllowed };
