import prisma from '@/lib/prisma';
import {
  classifyTenantIdentity,
  normalizeTenantStatus,
  tenantMatchesExportFilter,
} from './filters.js';
import { pickSafeSettings } from './settingsFields.js';

export const FORMAT_ID = 'insightbooks-tenant-identity-v1';
export const FORMAT_VERSION = 1;

function iso(d) {
  if (!d) return null;
  try {
    return new Date(d).toISOString();
  } catch {
    return null;
  }
}

function serializeSubscription(s) {
  return {
    id: s.id,
    tenantId: s.tenantId,
    plan: s.plan,
    txRef: s.txRef,
    amount: s.amount,
    currency: s.currency,
    status: s.status,
    paymentMethod: s.paymentMethod ?? null,
    notes: s.notes ?? null,
    isActive: Boolean(s.isActive),
    startedAt: iso(s.startedAt),
    expiresAt: iso(s.expiresAt),
    paymentDate: iso(s.paymentDate),
    gatewayResponse: s.gatewayResponse ?? null,
    isTrial: Boolean(s.isTrial),
    trialEndDate: iso(s.trialEndDate),
    trialStartDate: iso(s.trialStartDate),
    createdAt: iso(s.createdAt),
    updatedAt: iso(s.updatedAt),
  };
}

function serializeUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name ?? null,
    password: u.password,
    tenantId: u.tenantId ?? null,
    roleId: u.roleId,
    isActive: u.isActive !== false,
    status: u.status || 'active',
    isEmailVerified: Boolean(u.isEmailVerified),
    phone: u.phone ?? null,
    department: u.department ?? null,
    authProvider: u.authProvider ?? null,
    authProviderId: u.authProviderId ?? null,
    preferredLanguage: u.preferredLanguage ?? null,
    createdAt: iso(u.createdAt),
    updatedAt: iso(u.updatedAt),
  };
}

/**
 * @param {{ mode: string, tenantId?: string, subdomain?: string, sourceApp?: string, previewOnly?: boolean }} options
 */
export async function buildTenantIdentityPackage(options = {}, db = prisma) {
  const mode = options.mode || 'active';
  const sourceApp = options.sourceApp || 'v2.5';
  const now = new Date();

  if (mode === 'specific' && !options.tenantId && !options.subdomain) {
    const err = new Error('Specific export requires tenantId or subdomain.');
    err.code = 'INVALID_FILTER';
    throw err;
  }

  const tenantsRaw = await db.tenant.findMany({
    include: {
      accountSubscriptions: true,
      settings: true,
      roles: true,
      memberships: true,
      users: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const matched = tenantsRaw.filter((t) =>
    tenantMatchesExportFilter(mode, t, {
      tenantId: options.tenantId,
      subdomain: options.subdomain,
    }, now)
  );

  const preview = matched.map((t) => {
    const c = classifyTenantIdentity(t, now);
    return {
      id: t.id,
      name: t.name,
      subdomain: t.subdomain,
      status: t.status,
      subscriptionPlan: t.subscriptionPlan,
      subscriptionStatus: c.subscriptionStatus,
      paidBefore: c.paidBefore,
      userCount: Array.isArray(t.users) ? t.users.length : 0,
      roleCount: Array.isArray(t.roles) ? t.roles.length : 0,
      subscriptionCount: Array.isArray(t.accountSubscriptions)
        ? t.accountSubscriptions.length
        : 0,
    };
  });

  if (options.previewOnly) {
    return {
      format: FORMAT_ID,
      formatVersion: FORMAT_VERSION,
      exportedAt: now.toISOString(),
      sourceApp,
      filter: {
        mode,
        tenantId: options.tenantId || null,
        subdomain: options.subdomain || null,
      },
      preview,
      tenants: [],
    };
  }

  const tenants = matched.map((t) => {
    const c = classifyTenantIdentity(t, now);
    return {
      tenant: {
        id: t.id,
        name: t.name,
        subdomain: t.subdomain,
        status: normalizeTenantStatus(t.status),
        subscriptionPlan: t.subscriptionPlan ?? null,
        logoUrl: t.logoUrl ?? null,
        primaryColor: t.primaryColor ?? null,
        secondaryColor: t.secondaryColor ?? null,
        faviconUrl: t.faviconUrl ?? null,
        ownerUserId: t.ownerUserId ?? null,
        defaultBranchId: t.defaultBranchId ?? null,
        tpin: t.tpin ?? null,
        eisEnabled: Boolean(t.eisEnabled),
        createdAt: iso(t.createdAt),
        updatedAt: iso(t.updatedAt),
      },
      settings: t.settings
        ? {
            id: t.settings.id,
            tenantId: t.id,
            ...pickSafeSettings(t.settings),
          }
        : null,
      roles: (t.roles || []).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description ?? '',
        permissions: r.permissions ?? {},
        tenantId: r.tenantId ?? t.id,
        createdAt: iso(r.createdAt),
        updatedAt: iso(r.updatedAt),
      })),
      users: (t.users || []).map(serializeUser),
      memberships: (t.memberships || []).map((m) => ({
        id: m.id,
        userId: m.userId,
        tenantId: m.tenantId,
        roleId: m.roleId,
        status: m.status || 'active',
        createdAt: iso(m.createdAt),
        updatedAt: iso(m.updatedAt),
      })),
      subscriptions: (t.accountSubscriptions || []).map(serializeSubscription),
      derived: {
        subscriptionStatus: c.subscriptionStatus,
        paidBefore: c.paidBefore,
      },
    };
  });

  return {
    format: FORMAT_ID,
    formatVersion: FORMAT_VERSION,
    exportedAt: now.toISOString(),
    sourceApp,
    filter: {
      mode,
      tenantId: options.tenantId || null,
      subdomain: options.subdomain || null,
    },
    preview,
    tenants,
  };
}
