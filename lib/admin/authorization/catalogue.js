/**
 * Versioned platform role / permission catalogue (Phase 3).
 * Templates seed UI later; runtime still dual-reads Admin.permissions JSON.
 */

export const CATALOGUE_VERSION = 'platform-authz-2026-07-28';

export const PLATFORM_ROLE_CODES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  TECHNICAL_ADMIN: 'TECHNICAL_ADMIN',
  SECURITY_ADMIN: 'SECURITY_ADMIN',
  BILLING_ADMIN: 'BILLING_ADMIN',
  FINANCE_VIEWER: 'FINANCE_VIEWER',
  COMPLIANCE_ADMIN: 'COMPLIANCE_ADMIN',
  PLATFORM_AUDITOR: 'PLATFORM_AUDITOR',
  PLATFORM_SUPPORT: 'PLATFORM_SUPPORT',
  CUSTOMER_SUCCESS: 'CUSTOMER_SUCCESS',
  EXECUTIVE: 'EXECUTIVE',
  SALES_MANAGER: 'SALES_MANAGER',
  SALESPERSON: 'SALESPERSON',
});

/** Map legacy Admin.role display strings → catalogue codes. */
export const ROLE_DISPLAY_TO_CODE = Object.freeze({
  'Super Admin': PLATFORM_ROLE_CODES.SUPER_ADMIN,
  SUPER_ADMIN: PLATFORM_ROLE_CODES.SUPER_ADMIN,
  'Billing Administrator': PLATFORM_ROLE_CODES.BILLING_ADMIN,
  'Security Administrator': PLATFORM_ROLE_CODES.SECURITY_ADMIN,
  'Compliance Administrator': PLATFORM_ROLE_CODES.COMPLIANCE_ADMIN,
  'Platform Auditor': PLATFORM_ROLE_CODES.PLATFORM_AUDITOR,
  Auditor: PLATFORM_ROLE_CODES.PLATFORM_AUDITOR,
  'Platform Support': PLATFORM_ROLE_CODES.PLATFORM_SUPPORT,
  'Technical Administrator': PLATFORM_ROLE_CODES.TECHNICAL_ADMIN,
  Executive: PLATFORM_ROLE_CODES.EXECUTIVE,
  Finance: PLATFORM_ROLE_CODES.FINANCE_VIEWER,
  'Customer Success': PLATFORM_ROLE_CODES.CUSTOMER_SUCCESS,
  'Sales Manager': PLATFORM_ROLE_CODES.SALES_MANAGER,
  Salesperson: PLATFORM_ROLE_CODES.SALESPERSON,
});

/**
 * @param {string|undefined|null} role
 * @returns {string|null}
 */
export function resolveRoleCode(role) {
  if (!role) return null;
  return ROLE_DISPLAY_TO_CODE[role] || null;
}

export function isSuperAdminRole(role) {
  const code = resolveRoleCode(role);
  return code === PLATFORM_ROLE_CODES.SUPER_ADMIN || role === 'Super Admin';
}

/** Permissions that may be satisfied as ALLOW_MASKED via dashboard.view alone. */
export const MASKABLE_VIA_DASHBOARD_VIEW = new Set([
  'systemAdmin.dashboard.financialMetrics',
]);
