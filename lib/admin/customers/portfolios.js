/**
 * Customer portfolios + ownership — Phase 7 Wave 3.
 * CS ownership only; not AdminTenantAccess / Tenant.ownerUserId.
 */

import { authorizeAdminDecision } from '@/lib/admin/authorization/authorizeAdminDecision';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { resolveCustomerAccess } from './authz.js';
import {
  activeOwnershipWhere,
  OWNERSHIP_STATUS,
  resolvePortfolioScope,
} from './portfolioScope.js';
import { listUnassignedTenantIds } from './segments.js';

export const PORTFOLIO_TYPE = Object.freeze({
  CUSTOMER_SUCCESS: 'CUSTOMER_SUCCESS',
});

export const PORTFOLIO_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
});

export const ASSIGNMENT_TYPE = Object.freeze({
  CUSTOMER_SUCCESS_OWNER: 'CUSTOMER_SUCCESS_OWNER',
});

function canManagePortfolios(admin) {
  return authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.intel.managePortfolios,
  }).allowed;
}

function slugCode(input) {
  return String(input || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, includeArchived?: boolean }} opts
 */
export async function listPortfolios(prisma, opts = {}) {
  const access = resolveCustomerAccess(opts.admin);
  const manage = canManagePortfolios(opts.admin);
  if (!access.canView && !manage) {
    return { ok: false, forbidden: true, portfolios: [] };
  }

  if (!prisma?.customerPortfolio?.findMany) {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      error: 'CustomerPortfolio model unavailable — run prisma generate / SQL fallback',
      portfolios: [],
    };
  }

  try {
    const where = opts.includeArchived
      ? {}
      : { status: PORTFOLIO_STATUS.ACTIVE };
    const rows = await prisma.customerPortfolio.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        ownerAdmin: { select: { id: true, name: true, email: true } },
        _count: { select: { ownerships: true } },
      },
    });
    return {
      ok: true,
      portfolios: (rows || []).map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description || null,
        type: p.type,
        status: p.status,
        ownerAdminId: p.ownerAdminId || null,
        ownerAdmin: p.ownerAdmin || null,
        membershipCount: p._count?.ownerships ?? null,
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
        updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : null,
      })),
    };
  } catch (e) {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      error: e?.message || 'listPortfolios failed',
      portfolios: [],
    };
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   code?: string,
 *   name: string,
 *   description?: string,
 *   type?: string,
 *   ownerAdminId?: string|null,
 * }} opts
 */
export async function createPortfolio(prisma, opts = {}) {
  if (!canManagePortfolios(opts.admin)) {
    return { ok: false, forbidden: true, error: 'managePortfolios required' };
  }

  const name = String(opts.name || '').trim();
  if (!name) {
    return { ok: false, error: 'name required', badRequest: true };
  }
  const code = slugCode(opts.code || name);
  if (!code) {
    return { ok: false, error: 'code required', badRequest: true };
  }

  if (!prisma?.customerPortfolio?.create) {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      error: 'CustomerPortfolio model unavailable',
    };
  }

  try {
    const row = await prisma.customerPortfolio.create({
      data: {
        code,
        name,
        description: opts.description ? String(opts.description).trim() : null,
        type: opts.type || PORTFOLIO_TYPE.CUSTOMER_SUCCESS,
        status: PORTFOLIO_STATUS.ACTIVE,
        ownerAdminId: opts.ownerAdminId || opts.admin?.id || null,
      },
    });
    return {
      ok: true,
      portfolio: {
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
        type: row.type,
        status: row.status,
        ownerAdminId: row.ownerAdminId,
      },
    };
  } catch (e) {
    const msg = e?.message || 'createPortfolio failed';
    const conflict = /unique|duplicate/i.test(msg);
    return {
      ok: false,
      error: msg,
      conflict,
      status: conflict ? undefined : 'UNAVAILABLE',
    };
  }
}

/**
 * List ownership members for a portfolio (or all if portfolioId omitted via listActiveOwnership).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, portfolioId: string, now?: Date }} opts
 */
export async function listPortfolioMembers(prisma, opts = {}) {
  const access = resolveCustomerAccess(opts.admin);
  const manage = canManagePortfolios(opts.admin);
  if (!access.canView && !manage) {
    return { ok: false, forbidden: true, members: [] };
  }

  const portfolioId = opts.portfolioId ? String(opts.portfolioId) : '';
  if (!portfolioId) {
    return { ok: false, badRequest: true, error: 'portfolioId required', members: [] };
  }

  const now = opts.now || new Date();
  if (!prisma?.customerOwnership?.findMany) {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      error: 'CustomerOwnership model unavailable',
      members: [],
    };
  }

  try {
    const scope = await resolvePortfolioScope(prisma, opts.admin, { now });
    const where = {
      portfolioId,
      ...activeOwnershipWhere(now),
    };
    if (scope.mode === 'owned') {
      where.tenantId = { in: scope.tenantIds || [] };
    }

    const rows = await prisma.customerOwnership.findMany({
      where,
      orderBy: [{ isPrimary: 'desc' }, { startAt: 'desc' }],
      include: {
        tenant: { select: { id: true, name: true, subdomain: true, status: true } },
        ownerAdmin: { select: { id: true, name: true, email: true } },
        portfolio: { select: { id: true, code: true, name: true } },
      },
    });

    return {
      ok: true,
      members: (rows || []).map(serializeOwnership),
    };
  } catch (e) {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      error: e?.message || 'listPortfolioMembers failed',
      members: [],
    };
  }
}

/**
 * Assign or reassign CS ownership for a tenant.
 * Ends prior ACTIVE primary ownership for the tenant when isPrimary.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   tenantId: string,
 *   ownerAdminId: string,
 *   portfolioId?: string|null,
 *   isPrimary?: boolean,
 *   reason?: string,
 *   assignmentType?: string,
 *   now?: Date,
 * }} opts
 */
export async function assignOwnership(prisma, opts = {}) {
  if (!canManagePortfolios(opts.admin)) {
    return { ok: false, forbidden: true, error: 'managePortfolios required' };
  }

  const tenantId = opts.tenantId ? String(opts.tenantId) : '';
  const ownerAdminId = opts.ownerAdminId ? String(opts.ownerAdminId) : '';
  if (!tenantId || !ownerAdminId) {
    return {
      ok: false,
      badRequest: true,
      error: 'tenantId and ownerAdminId required',
    };
  }

  if (!prisma?.customerOwnership?.create) {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      error: 'CustomerOwnership model unavailable',
    };
  }

  const now = opts.now || new Date();
  const isPrimary = opts.isPrimary !== false;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      return { ok: false, notFound: true, error: 'Tenant not found' };
    }

    if (opts.portfolioId) {
      const portfolio = await prisma.customerPortfolio.findUnique({
        where: { id: String(opts.portfolioId) },
        select: { id: true, status: true },
      });
      if (!portfolio || portfolio.status !== PORTFOLIO_STATUS.ACTIVE) {
        return { ok: false, badRequest: true, error: 'Active portfolio required' };
      }
    }

    if (isPrimary) {
      await prisma.customerOwnership.updateMany({
        where: {
          tenantId,
          isPrimary: true,
          ...activeOwnershipWhere(now),
        },
        data: {
          status: OWNERSHIP_STATUS.ENDED,
          endAt: now,
          reason: opts.reason
            ? `Reassigned: ${opts.reason}`
            : 'Reassigned (primary replaced)',
        },
      });
    }

    const row = await prisma.customerOwnership.create({
      data: {
        tenantId,
        portfolioId: opts.portfolioId ? String(opts.portfolioId) : null,
        ownerAdminId,
        assignmentType: opts.assignmentType || ASSIGNMENT_TYPE.CUSTOMER_SUCCESS_OWNER,
        isPrimary,
        startAt: now,
        reason: opts.reason ? String(opts.reason).trim() : null,
        assignedByAdminId: opts.admin?.id || null,
        status: OWNERSHIP_STATUS.ACTIVE,
      },
      include: {
        tenant: { select: { id: true, name: true, subdomain: true, status: true } },
        ownerAdmin: { select: { id: true, name: true, email: true } },
        portfolio: { select: { id: true, code: true, name: true } },
      },
    });

    return { ok: true, ownership: serializeOwnership(row) };
  } catch (e) {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      error: e?.message || 'assignOwnership failed',
    };
  }
}

/**
 * Unassigned tenants (no ACTIVE CS ownership), optionally scoped for agents.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, now?: Date, page?: number, pageSize?: number, q?: string }} opts
 */
export async function listUnassignedCustomers(prisma, opts = {}) {
  const access = resolveCustomerAccess(opts.admin);
  const manage = canManagePortfolios(opts.admin);
  if (!access.canView && !manage) {
    return { ok: false, forbidden: true, rows: [], total: 0 };
  }

  const now = opts.now || new Date();
  const page = Math.max(1, parseInt(String(opts.page || 1), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(opts.pageSize || 25), 10) || 25));
  const q = String(opts.q || '').trim();

  // Agents with ownership never "own" unassigned tenants — return empty for them.
  const scope = await resolvePortfolioScope(prisma, opts.admin, { now });
  if (scope.mode === 'owned') {
    return {
      ok: true,
      rows: [],
      page,
      pageSize,
      total: 0,
      limitations: 'Portfolio-scoped agents do not see the unassigned queue.',
    };
  }

  const unassigned = await listUnassignedTenantIds(prisma, { now, take: 2000 });
  if (!unassigned.ok) {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      error: unassigned.error || 'Unassigned query failed',
      rows: [],
      page,
      pageSize,
      total: null,
    };
  }

  const ids = unassigned.tenantIds;
  if (ids.length === 0) {
    return { ok: true, rows: [], page, pageSize, total: 0 };
  }

  const where = { id: { in: ids } };
  if (q) {
    where.AND = [
      {
        OR: [
          { name: { contains: q } },
          { subdomain: { contains: q } },
          { id: { contains: q } },
        ],
      },
    ];
  }

  try {
    const [total, tenants] = await Promise.all([
      prisma.tenant.count({ where }),
      prisma.tenant.findMany({
        where,
        select: {
          id: true,
          name: true,
          subdomain: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      ok: true,
      rows: (tenants || []).map((t) => ({
        tenantId: t.id,
        displayName: t.name || t.subdomain || t.id,
        customerReference: t.subdomain || t.id,
        status: t.status || null,
        customerSince: t.createdAt ? new Date(t.createdAt).toISOString() : null,
      })),
      page,
      pageSize,
      total,
    };
  } catch (e) {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      error: e?.message || 'listUnassignedCustomers failed',
      rows: [],
      page,
      pageSize,
      total: null,
    };
  }
}

/**
 * Load ownership summary for customer 360.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {{ now?: Date }} [opts]
 */
export async function loadTenantOwnership(prisma, tenantId, opts = {}) {
  const now = opts.now || new Date();
  if (!tenantId || !prisma?.customerOwnership?.findMany) {
    return {
      portfolioId: null,
      portfolioCode: null,
      portfolioName: null,
      primaryOwnerId: null,
      primaryOwnerName: null,
      primaryOwnerEmail: null,
      assignments: [],
      status: 'UNAVAILABLE',
      limitations: 'CustomerOwnership model unavailable',
    };
  }

  try {
    const rows = await prisma.customerOwnership.findMany({
      where: {
        tenantId: String(tenantId),
        ...activeOwnershipWhere(now),
      },
      orderBy: [{ isPrimary: 'desc' }, { startAt: 'desc' }],
      include: {
        ownerAdmin: { select: { id: true, name: true, email: true } },
        portfolio: { select: { id: true, code: true, name: true } },
      },
    });
    const primary = (rows || []).find((r) => r.isPrimary) || rows?.[0] || null;
    return {
      portfolioId: primary?.portfolioId || null,
      portfolioCode: primary?.portfolio?.code || null,
      portfolioName: primary?.portfolio?.name || null,
      primaryOwnerId: primary?.ownerAdminId || null,
      primaryOwnerName: primary?.ownerAdmin?.name || null,
      primaryOwnerEmail: primary?.ownerAdmin?.email || null,
      assignments: (rows || []).map(serializeOwnership),
      status: primary ? 'READY' : 'READY_WITH_LIMITATIONS',
      limitations: primary ? null : 'No ACTIVE CustomerOwnership for this tenant.',
    };
  } catch (e) {
    return {
      portfolioId: null,
      portfolioCode: null,
      portfolioName: null,
      primaryOwnerId: null,
      primaryOwnerName: null,
      primaryOwnerEmail: null,
      assignments: [],
      status: 'UNAVAILABLE',
      limitations: e?.message || 'ownership_query_failed',
    };
  }
}

function serializeOwnership(row) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    portfolioId: row.portfolioId || null,
    portfolioCode: row.portfolio?.code || null,
    portfolioName: row.portfolio?.name || null,
    ownerAdminId: row.ownerAdminId,
    ownerAdminName: row.ownerAdmin?.name || null,
    ownerAdminEmail: row.ownerAdmin?.email || null,
    assignmentType: row.assignmentType,
    isPrimary: Boolean(row.isPrimary),
    startAt: row.startAt ? new Date(row.startAt).toISOString() : null,
    endAt: row.endAt ? new Date(row.endAt).toISOString() : null,
    reason: row.reason || null,
    assignedByAdminId: row.assignedByAdminId || null,
    status: row.status,
    tenant: row.tenant
      ? {
          id: row.tenant.id,
          name: row.tenant.name,
          subdomain: row.tenant.subdomain,
          status: row.tenant.status,
        }
      : undefined,
  };
}
