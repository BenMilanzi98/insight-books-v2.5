/**
 * Server-side Customer directory — Tenant = Customer, paginated.
 */

import { resolveCustomerAccess } from './authz.js';
import { CUSTOMER_CATALOGUE_VERSION, LIFECYCLE_STAGES } from './catalogue.js';
import { resolveLifecycleStage } from './lifecycle.js';
import { buildCommercialSection } from './commercial.js';
import {
  applyPortfolioTenantWhere,
  resolvePortfolioScope,
} from './portfolioScope.js';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   q?: string,
 *   page?: number,
 *   pageSize?: number,
 *   lifecycle?: string,
 *   currency?: string,
 *   now?: Date,
 * }} opts
 */
export async function listCustomerDirectory(prisma, opts = {}) {
  const access = resolveCustomerAccess(opts.admin);
  if (!access.canView) {
    return {
      ok: false,
      forbidden: true,
      catalogueVersion: CUSTOMER_CATALOGUE_VERSION,
      rows: [],
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      total: 0,
    };
  }

  const page = Math.max(1, parseInt(String(opts.page || 1), 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(String(opts.pageSize || DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  );
  const q = String(opts.q || '').trim();
  const lifecycleFilter = opts.lifecycle
    ? String(opts.lifecycle).trim().toUpperCase()
    : null;
  const currency = opts.currency || 'MWK';
  const now = opts.now || new Date();

  const scope = await resolvePortfolioScope(prisma, opts.admin, { now });
  if (!scope.canViewCustomers) {
    return {
      ok: false,
      forbidden: true,
      catalogueVersion: CUSTOMER_CATALOGUE_VERSION,
      rows: [],
      page,
      pageSize,
      total: 0,
    };
  }

  let where = {};
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { subdomain: { contains: q } },
      { id: { contains: q } },
    ];
  }
  where = applyPortfolioTenantWhere(where, scope);

  // Lifecycle filter requires post-filter when stage is derived; for ARCHIVED/SUSPENDED
  // we can push Tenant.status predicates for efficiency.
  if (lifecycleFilter === LIFECYCLE_STAGES.ARCHIVED) {
    where.status = { in: ['ARCHIVED', 'CLOSED', 'archived'] };
  } else if (lifecycleFilter === LIFECYCLE_STAGES.SUSPENDED) {
    where.status = {
      in: ['SUSPENDED', 'SUSPENSION_PENDING', 'RESTRICTED', 'suspended'],
    };
  } else if (lifecycleFilter === LIFECYCLE_STAGES.TRIAL) {
    where.status = { in: ['TRIAL', 'trial'] };
  }

  let total = 0;
  let tenants = [];
  try {
    // When filtering by derived lifecycle stages, fetch a bounded window then filter.
    const derivedFilter =
      lifecycleFilter &&
      ![
        LIFECYCLE_STAGES.ARCHIVED,
        LIFECYCLE_STAGES.SUSPENDED,
        LIFECYCLE_STAGES.TRIAL,
      ].includes(lifecycleFilter);

    if (derivedFilter) {
      const candidates = await prisma.tenant.findMany({
        where,
        select: {
          id: true,
          name: true,
          subdomain: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          subscriptionPlan: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      const enriched = [];
      for (const t of candidates) {
        const commercial = await buildCommercialSection(prisma, t.id, {
          currency,
          now,
          financeOk: access.financeOk,
          financeMasked: access.financeMasked,
        });
        const life = resolveLifecycleStage(t, {
          subscriptions: commercial.subscriptions || [],
          activeSubscription: commercial.activeSubscription || null,
          hasOutstanding: Boolean(commercial.hasOutstanding),
          now,
        });
        if (life.stage !== lifecycleFilter) continue;
        enriched.push({ tenant: t, commercial, lifecycle: life });
      }
      total = enriched.length;
      const slice = enriched.slice((page - 1) * pageSize, page * pageSize);
      const rows = slice.map(({ tenant: t, commercial, lifecycle }) =>
        rowFromParts(t, commercial, lifecycle, access)
      );
      return {
        ok: true,
        catalogueVersion: CUSTOMER_CATALOGUE_VERSION,
        rows,
        page,
        pageSize,
        total,
        limitations:
          'Lifecycle filter for derived stages scans up to 500 recent tenants matching q.',
      };
    }

    [total, tenants] = await Promise.all([
      prisma.tenant.count({ where }),
      prisma.tenant.findMany({
        where,
        select: {
          id: true,
          name: true,
          subdomain: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          subscriptionPlan: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
  } catch (e) {
    return {
      ok: false,
      error: e?.message || 'Directory query failed',
      catalogueVersion: CUSTOMER_CATALOGUE_VERSION,
      rows: [],
      page,
      pageSize,
      total: null,
      status: 'UNAVAILABLE',
    };
  }

  const rows = [];
  for (const t of tenants) {
    const commercial = await buildCommercialSection(prisma, t.id, {
      currency,
      now,
      financeOk: access.financeOk,
      financeMasked: access.financeMasked,
    });
    const lifecycle = resolveLifecycleStage(t, {
      subscriptions: commercial.subscriptions || [],
      activeSubscription: commercial.activeSubscription || null,
      hasOutstanding: Boolean(commercial.hasOutstanding),
      now,
    });
    rows.push(rowFromParts(t, commercial, lifecycle, access));
  }

  return {
    ok: true,
    catalogueVersion: CUSTOMER_CATALOGUE_VERSION,
    rows,
    page,
    pageSize,
    total,
  };
}

function rowFromParts(tenant, commercial, lifecycle, access) {
  const row = {
    tenantId: tenant.id,
    customerReference: tenant.subdomain || tenant.id,
    displayName: tenant.name || tenant.subdomain || tenant.id,
    status: tenant.status || null,
    lifecycleStage: lifecycle.stage,
    customerSince: tenant.createdAt ? new Date(tenant.createdAt).toISOString() : null,
    plan: commercial.plan,
    subscriptionStatus: commercial.subscriptionStatus,
  };

  if (access.financeOk) {
    row.currency = commercial.currency;
    row.mrr = commercial.mrr;
    row.outstanding = commercial.outstanding;
    row.commercialStatus = commercial.status;
    if (access.financeMasked) {
      row.masked = true;
    }
  } else {
    row.currency = null;
    row.mrr = null;
    row.outstanding = null;
    row.commercialStatus = 'FORBIDDEN';
  }

  return row;
}
