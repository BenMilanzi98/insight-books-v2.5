/**
 * Phase 18 — Server-authoritative EIS admin context.
 * Browser cannot select unauthorized Tenant / Business / Environment.
 */

import { AdminErrors } from './adminErrors.js';
import { environmentBadge, FRESHNESS } from './statusDesignSystem.js';

/**
 * Resolve and validate EIS admin context from authenticated user + request.
 */
export function resolveEisAdminContext({
  user,
  requestedTenantId = null,
  requestedBusinessId = null,
  requestedBranchId = null,
  environment = 'SANDBOX',
  roleHint = null,
} = {}) {
  if (!user?.tenantId && !user?.isSuperAdmin && !user?.isSystemAdmin) {
    throw AdminErrors.context({ message: 'Authentication required for EIS Administration Centre.' });
  }

  const isPlatformAdmin = Boolean(user?.isSuperAdmin || user?.isSystemAdmin);
  const sessionTenantId = user?.tenantId || null;

  let tenantId = sessionTenantId;
  if (isPlatformAdmin && requestedTenantId) {
    tenantId = requestedTenantId;
  } else if (requestedTenantId && requestedTenantId !== sessionTenantId) {
    throw AdminErrors.crossTenant({
      message: 'Tenant A cannot open Tenant B EIS context.',
    });
  }

  // Tenant equals Business in this platform (businessId aliases tenantId)
  let businessId = tenantId;
  if (requestedBusinessId) {
    if (!isPlatformAdmin && requestedBusinessId !== sessionTenantId) {
      throw AdminErrors.businessScope({
        message: 'Business scope does not match session Tenant.',
      });
    }
    businessId = requestedBusinessId;
    if (!isPlatformAdmin) tenantId = sessionTenantId;
  }

  const env = String(environment || 'SANDBOX').toUpperCase();
  if (!['SANDBOX', 'PRODUCTION', 'CERTIFICATION', 'MOCK'].includes(env)) {
    throw AdminErrors.environment({ message: `Invalid environment: ${environment}` });
  }

  // Sandbox and production must never mix in one context object
  const role =
    roleHint ||
    (isPlatformAdmin
      ? 'SYSTEM_ADMINISTRATOR'
      : user?.role === 'AUDITOR'
        ? 'AUDITOR'
        : 'TENANT_ADMINISTRATOR');

  return {
    actorId: user?.id || null,
    realActorId: user?.realActorId || user?.id || null,
    effectiveActorId: user?.id || null,
    impersonating: Boolean(user?.impersonating),
    isPlatformAdmin,
    role,
    tenantId,
    businessId,
    branchId: requestedBranchId || null,
    environment: env,
    environmentBadge: environmentBadge(env),
    auditorReadOnly: role === 'AUDITOR',
    resolvedAt: new Date().toISOString(),
    serverAuthoritative: true,
  };
}

export function buildContextBarModel(context, extras = {}) {
  return {
    tenantId: context.tenantId,
    businessId: context.businessId,
    branchId: context.branchId,
    environment: context.environment,
    environmentLabel: context.environmentBadge.label,
    environmentSrText: context.environmentBadge.srText,
    platformEisStatus: extras.platformEisStatus || 'UNKNOWN',
    effectiveCapabilityStatus: extras.effectiveCapabilityStatus || 'UNKNOWN',
    primaryRestriction: extras.primaryRestriction || null,
    dataFreshness: extras.dataFreshness || FRESHNESS.CURRENT,
    lastRefreshAt: extras.lastRefreshAt || new Date().toISOString(),
    impersonating: context.impersonating,
    realActorId: context.realActorId,
    effectiveActorId: context.effectiveActorId,
    helpHref: '/settings/integrations/mra-eis',
  };
}

/** Information architecture — primary sections */
export const EIS_ADMIN_SECTIONS = Object.freeze([
  { id: 'overview', label: 'Overview', href: '/settings/integrations/mra-eis/centre' },
  { id: 'terminals', label: 'Terminals', href: '/settings/integrations/mra-eis/terminals' },
  { id: 'agents', label: 'Agents & Devices', href: '/settings/integrations/mra-eis/offline' },
  { id: 'configuration', label: 'Configuration', href: '/settings/integrations/mra-eis/terminals' },
  { id: 'catalogue', label: 'Catalogue & Mappings', href: '/settings/integrations/mra-eis/catalogue' },
  { id: 'mappings', label: 'Tax / Levy / Payment', href: '/settings/integrations/mra-eis/mappings' },
  { id: 'transmissions', label: 'Transactions', href: '/settings/integrations/mra-eis/sales-transmission' },
  { id: 'reconciliation', label: 'Reconciliation', href: '/settings/integrations/mra-eis/reconciliation' },
  { id: 'offline', label: 'Offline', href: '/settings/integrations/mra-eis/offline' },
  { id: 'receipts', label: 'Fiscal Receipts', href: '/settings/integrations/mra-eis/fiscal-receipts' },
  { id: 'restrictions', label: 'Restrictions', href: '/settings/integrations/mra-eis/restrictions' },
  { id: 'migration', label: 'Data Migration', href: '/settings/integrations/mra-eis/migration' },
  { id: 'phase21', label: 'Certification & Rollout', href: '/settings/integrations/mra-eis/phase21' },
  { id: 'certification', label: 'Certification', href: '/settings/integrations/mra-eis/centre?section=certification' },
  { id: 'manual-review', label: 'Manual Review', href: '/settings/integrations/mra-eis/centre?section=manual-review' },
  { id: 'incidents', label: 'Incidents', href: '/settings/integrations/mra-eis/centre?section=incidents' },
  { id: 'alerts', label: 'Alerts', href: '/settings/integrations/mra-eis/centre?section=alerts' },
  { id: 'audit', label: 'Audit & Evidence', href: '/settings/integrations/mra-eis/centre?section=audit' },
  { id: 'reports', label: 'Reports & Exports', href: '/settings/integrations/mra-eis/centre?section=reports' },
]);

export const SYSTEM_EIS_ADMIN_SECTIONS = Object.freeze([
  { id: 'entitlements', label: 'Entitlements', href: '/insightbooks/mra-eis' },
  { id: 'overview', label: 'Platform Overview', href: '/insightbooks/mra-eis/centre' },
  { id: 'terminals', label: 'Terminals', href: '/insightbooks/mra-eis/terminals' },
  { id: 'configuration', label: 'Configuration', href: '/insightbooks/mra-eis/configuration' },
  { id: 'mappings', label: 'Mappings', href: '/insightbooks/mra-eis/mappings' },
  { id: 'catalogue', label: 'Catalogue', href: '/insightbooks/mra-eis/catalogue' },
]);
