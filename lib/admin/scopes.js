/** Explicit Admin query/mutation scope tags. */
export const ADMIN_SCOPES = Object.freeze({
  PLATFORM_GLOBAL: 'PLATFORM_GLOBAL',
  TENANT_SCOPED: 'TENANT_SCOPED',
  BUSINESS_SCOPED: 'BUSINESS_SCOPED',
  BRANCH_SCOPED: 'BRANCH_SCOPED',
  USER_SCOPED: 'USER_SCOPED',
  SALES_TEAM_SCOPED: 'SALES_TEAM_SCOPED',
  LEAD_OWNER_SCOPED: 'LEAD_OWNER_SCOPED',
  SECURITY_RESTRICTED: 'SECURITY_RESTRICTED',
});

/**
 * @param {string} requiredScope
 * @param {string|null|undefined} actualScope
 */
export function assertAdminScope(requiredScope, actualScope) {
  if (!requiredScope) return;
  if (actualScope !== requiredScope) {
    const err = new Error(
      `Admin scope mismatch: required ${requiredScope}, got ${actualScope || 'none'}`
    );
    err.code = 'ADMIN_SCOPE_MISMATCH';
    throw err;
  }
}
