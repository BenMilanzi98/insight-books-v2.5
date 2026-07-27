/**
 * Granular systemAdmin.* permission catalog for the platform control plane.
 * Stored on Admin.permissions as nested objects; Super Admin bypasses checks.
 */

export const SYSTEM_ADMIN_PERMISSIONS = {
  dashboard: {
    view: 'systemAdmin.dashboard.view',
    financialMetrics: 'systemAdmin.dashboard.financialMetrics',
    securityMetrics: 'systemAdmin.dashboard.securityMetrics',
    operationalMetrics: 'systemAdmin.dashboard.operationalMetrics',
  },
  tenants: {
    view: 'systemAdmin.tenants.view',
    create: 'systemAdmin.tenants.create',
    edit: 'systemAdmin.tenants.edit',
    activate: 'systemAdmin.tenants.activate',
    suspend: 'systemAdmin.tenants.suspend',
    reactivate: 'systemAdmin.tenants.reactivate',
    archive: 'systemAdmin.tenants.archive',
    export: 'systemAdmin.tenants.export',
    supportAccess: 'systemAdmin.tenants.supportAccess',
  },
  users: {
    view: 'systemAdmin.users.view',
    create: 'systemAdmin.users.create',
    edit: 'systemAdmin.users.edit',
    assignTenant: 'systemAdmin.users.assignTenant',
    assignRole: 'systemAdmin.users.assignRole',
    resetPassword: 'systemAdmin.users.resetPassword',
    revokeSessions: 'systemAdmin.users.revokeSessions',
    lock: 'systemAdmin.users.lock',
    unlock: 'systemAdmin.users.unlock',
    suspend: 'systemAdmin.users.suspend',
    archive: 'systemAdmin.users.archive',
    export: 'systemAdmin.users.export',
  },
  settings: {
    view: 'systemAdmin.settings.view',
    manage: 'systemAdmin.settings.manage',
    security: 'systemAdmin.settings.security',
    billing: 'systemAdmin.settings.billing',
    email: 'systemAdmin.settings.email',
    features: 'systemAdmin.settings.features',
    integrations: 'systemAdmin.settings.integrations',
  },
  android: {
    view: 'systemAdmin.android.view',
    createRelease: 'systemAdmin.android.createRelease',
    publishRelease: 'systemAdmin.android.publishRelease',
    revokeRelease: 'systemAdmin.android.revokeRelease',
  },
  affiliates: {
    view: 'systemAdmin.affiliates.view',
    create: 'systemAdmin.affiliates.create',
    approve: 'systemAdmin.affiliates.approve',
    manageCommissions: 'systemAdmin.affiliates.manageCommissions',
    approvePayouts: 'systemAdmin.affiliates.approvePayouts',
    export: 'systemAdmin.affiliates.export',
  },
  billing: {
    view: 'systemAdmin.billing.view',
    plansManage: 'systemAdmin.billing.plans.manage',
    subscriptionsManage: 'systemAdmin.billing.subscriptions.manage',
    invoicesCreate: 'systemAdmin.billing.invoices.create',
    invoicesApprove: 'systemAdmin.billing.invoices.approve',
    paymentsView: 'systemAdmin.billing.payments.view',
    paymentsManage: 'systemAdmin.billing.payments.manage',
    creditsManage: 'systemAdmin.billing.credits.manage',
    refundsManage: 'systemAdmin.billing.refunds.manage',
    reconciliation: 'systemAdmin.billing.reconciliation',
    reportsExport: 'systemAdmin.billing.reports.export',
  },
  email: {
    view: 'systemAdmin.email.view',
    configurationManage: 'systemAdmin.email.configuration.manage',
    templatesManage: 'systemAdmin.email.templates.manage',
    logsView: 'systemAdmin.email.logs.view',
    retry: 'systemAdmin.email.retry',
    suppressionManage: 'systemAdmin.email.suppression.manage',
  },
  mraEntitlement: {
    view: 'systemAdmin.mraEntitlement.view',
    grant: 'systemAdmin.mraEntitlement.grant',
    suspend: 'systemAdmin.mraEntitlement.suspend',
    revoke: 'systemAdmin.mraEntitlement.revoke',
    export: 'systemAdmin.mraEntitlement.export',
  },
  audit: {
    view: 'systemAdmin.audit.view',
    export: 'systemAdmin.audit.export',
  },
  security: {
    view: 'systemAdmin.security.view',
    manageSessions: 'systemAdmin.security.manageSessions',
    manageLocks: 'systemAdmin.security.manageLocks',
    reviewImpersonation: 'systemAdmin.security.reviewImpersonation',
    manageAlerts: 'systemAdmin.security.manageAlerts',
  },
  health: {
    view: 'systemAdmin.health.view',
    retryJobs: 'systemAdmin.health.retryJobs',
    cancelJobs: 'systemAdmin.health.cancelJobs',
    manageIncidents: 'systemAdmin.health.manageIncidents',
  },
};

export const ADMIN_ROLES = {
  SUPER_ADMIN: 'Super Admin',
  BILLING_ADMIN: 'Billing Administrator',
  SECURITY_ADMIN: 'Security Administrator',
  COMPLIANCE_ADMIN: 'Compliance Administrator',
  PLATFORM_AUDITOR: 'Platform Auditor',
  PLATFORM_SUPPORT: 'Platform Support',
};

/** Map nav href prefixes to required permission (view). */
export const NAV_PERMISSION_MAP = {
  '/insightbooks/dashboard': SYSTEM_ADMIN_PERMISSIONS.dashboard.view,
  '/insightbooks/tenant-management': SYSTEM_ADMIN_PERMISSIONS.tenants.view,
  '/insightbooks/user-management': SYSTEM_ADMIN_PERMISSIONS.users.view,
  '/insightbooks/global-settings': SYSTEM_ADMIN_PERMISSIONS.settings.view,
  '/insightbooks/feature-entitlements': SYSTEM_ADMIN_PERMISSIONS.settings.features,
  '/insightbooks/mobile-app': SYSTEM_ADMIN_PERMISSIONS.android.view,
  '/insightbooks/affiliate': SYSTEM_ADMIN_PERMISSIONS.affiliates.view,
  '/insightbooks/affiliate/commissions': SYSTEM_ADMIN_PERMISSIONS.affiliates.view,
  '/insightbooks/affiliate/payouts': SYSTEM_ADMIN_PERMISSIONS.affiliates.view,
  '/insightbooks/billing': SYSTEM_ADMIN_PERMISSIONS.billing.view,
  '/insightbooks/reports': SYSTEM_ADMIN_PERMISSIONS.billing.view,
  '/insightbooks/imports': SYSTEM_ADMIN_PERMISSIONS.tenants.create,
  '/insightbooks/email-management': SYSTEM_ADMIN_PERMISSIONS.email.view,
  '/insightbooks/email-management/templates': SYSTEM_ADMIN_PERMISSIONS.email.view,
  '/insightbooks/email-management/suppression': SYSTEM_ADMIN_PERMISSIONS.email.view,
  '/insightbooks/mra-eis': SYSTEM_ADMIN_PERMISSIONS.mraEntitlement.view,
  '/insightbooks/audit': SYSTEM_ADMIN_PERMISSIONS.audit.view,
  '/insightbooks/security': SYSTEM_ADMIN_PERMISSIONS.security.view,
  '/insightbooks/security/monitoring': SYSTEM_ADMIN_PERMISSIONS.security.view,
  '/insightbooks/security/compliance': SYSTEM_ADMIN_PERMISSIONS.security.view,
  '/insightbooks/system-health': SYSTEM_ADMIN_PERMISSIONS.health.view,
};

/**
 * Parse "systemAdmin.tenants.view" or "category.action" into nested lookup keys.
 */
export function permissionKeyParts(permission) {
  if (!permission || typeof permission !== 'string') return null;
  const parts = permission.split('.');
  if (parts[0] === 'systemAdmin' && parts.length >= 3) {
    return {
      root: 'systemAdmin',
      category: parts[1],
      action: parts.slice(2).join('.'),
    };
  }
  if (parts.length === 2) {
    return { root: null, category: parts[0], action: parts[1] };
  }
  return null;
}

/**
 * Client-safe permission check (no Prisma / JWT imports).
 * Super Admin always allowed. Supports systemAdmin.* and legacy category.action.
 */
export function adminHasPermission(admin, permission) {
  if (!admin) return false;
  if (admin.role === 'Super Admin' || admin.role === ADMIN_ROLES.SUPER_ADMIN) {
    return true;
  }
  if (!admin.permissions || typeof admin.permissions !== 'object') {
    return false;
  }
  const parts = permissionKeyParts(permission);
  if (!parts) return false;

  if (parts.root === 'systemAdmin') {
    const bucket = admin.permissions.systemAdmin?.[parts.category];
    if (bucket && typeof bucket === 'object') {
      return bucket[parts.action] === true;
    }
    // Flat key fallback: permissions['systemAdmin.tenants.view']
    if (admin.permissions[permission] === true) return true;
    return false;
  }

  return admin.permissions[parts.category]?.[parts.action] === true;
}
