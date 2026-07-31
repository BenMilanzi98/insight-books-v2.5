/**
 * Customer 360 read model builder — Tenant = Customer.
 * Section-partial OK; failed/uninstrumented sections never fake zeroes.
 */

import { resolveCustomerAccess } from './authz.js';
import {
  CUSTOMER_CATALOGUE_VERSION,
  CUSTOMER_READINESS,
  CUSTOMER_SECTION_CODES,
  LIFECYCLE_RULE_VERSION,
} from './catalogue.js';
import { resolveLifecycleStage } from './lifecycle.js';
import { buildHierarchySection } from './hierarchy.js';
import { buildEngagementSection } from './engagement.js';
import { buildCommercialSection } from './commercial.js';
import { buildMraEisSection } from './mraEis.js';
import { assertTenantInPortfolio } from './portfolioScope.js';
import { loadTenantOwnership } from './portfolios.js';
import { buildSignalsSection } from './signals.js';
import { CUSTOMER_SIGNAL_RULE_VERSION } from './signalCatalogue.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   tenantId: string,
 *   currency?: string,
 *   now?: Date,
 * }} opts
 */
export async function buildCustomer360(prisma, opts = {}) {
  const admin = opts.admin;
  const tenantId = opts.tenantId ? String(opts.tenantId) : '';
  const currency = opts.currency || 'MWK';
  const now = opts.now || new Date();
  const generatedAt = now.toISOString();

  const access = resolveCustomerAccess(admin);
  if (!access.canView) {
    return {
      ok: false,
      forbidden: true,
      catalogueVersion: CUSTOMER_CATALOGUE_VERSION,
    };
  }

  if (!tenantId) {
    return {
      ok: false,
      notFound: true,
      error: 'tenantId required',
      catalogueVersion: CUSTOMER_CATALOGUE_VERSION,
    };
  }

  const scopeCheck = await assertTenantInPortfolio(prisma, admin, tenantId, { now });
  if (!scopeCheck.ok) {
    return {
      ok: false,
      forbidden: true,
      reason: scopeCheck.reason || 'out_of_portfolio_scope',
      catalogueVersion: CUSTOMER_CATALOGUE_VERSION,
    };
  }

  let tenant = null;
  try {
    tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subdomain: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        subscriptionPlan: true,
      },
    });
  } catch (e) {
    return {
      ok: false,
      error: e?.message || 'Tenant query failed',
      catalogueVersion: CUSTOMER_CATALOGUE_VERSION,
    };
  }

  if (!tenant) {
    return {
      ok: false,
      notFound: true,
      error: 'Customer (tenant) not found',
      catalogueVersion: CUSTOMER_CATALOGUE_VERSION,
    };
  }

  const [hierarchy, engagement, commercial, ownership] = await Promise.all([
    buildHierarchySection(prisma, tenantId),
    buildEngagementSection(prisma, tenantId, { now }),
    buildCommercialSection(prisma, tenantId, {
      currency,
      now,
      financeOk: access.financeOk,
      financeMasked: access.financeMasked,
    }),
    loadTenantOwnership(prisma, tenantId, { now }),
  ]);

  const lifecycle = resolveLifecycleStage(tenant, {
    subscriptions: commercial.subscriptions || [],
    activeSubscription: commercial.activeSubscription || null,
    hasOutstanding: Boolean(commercial.hasOutstanding),
    now,
  });

  const mraEis = await buildMraEisSection(prisma, tenantId, {
    subscriptions: commercial.subscriptions || [],
  });

  const signals = await buildSignalsSection(prisma, tenantId, {
    now,
    currency,
    persist: true,
  });

  const limitations = [
    ...(lifecycle.limitations || []),
    ...(hierarchy.limitations ? [hierarchy.limitations] : []),
    ...(engagement.limitations ? [engagement.limitations] : []),
    ...(commercial.limitations ? [commercial.limitations] : []),
    ...(mraEis.limitations ? [mraEis.limitations] : []),
    ...(ownership.limitations ? [ownership.limitations] : []),
    ...(signals.limitations ? [signals.limitations] : []),
    'Adoption UNAVAILABLE until FEATURE_USED is emitted.',
    'Support / onboarding / training NOT_INSTRUMENTED.',
  ];

  return {
    ok: true,
    forbidden: false,
    catalogueVersion: CUSTOMER_CATALOGUE_VERSION,
    customer: {
      tenantId: tenant.id,
      customerReference: tenant.subdomain || tenant.id,
      displayName: tenant.name || tenant.subdomain || tenant.id,
      lifecycleStage: lifecycle.stage,
      customerSince: tenant.createdAt ? new Date(tenant.createdAt).toISOString() : null,
      status: tenant.status || null,
    },
    hierarchy: {
      branchCount: hierarchy.branchCount,
      userCount: hierarchy.userCount,
      activeUserCount: hierarchy.activeUserCount,
      status: hierarchy.status,
      limitations: hierarchy.limitations || null,
    },
    commercial: {
      plan: commercial.plan,
      subscriptionStatus: commercial.subscriptionStatus,
      currency: commercial.currency,
      mrr: commercial.mrr,
      arr: commercial.arr,
      billed: commercial.billed,
      collected: commercial.collected,
      outstanding: commercial.outstanding,
      renewalDate: commercial.renewalDate,
      status: commercial.status,
      _envelope: commercial._envelope || null,
      limitations: commercial.limitations || null,
      reason: commercial.reason || null,
    },
    engagement: {
      lastLoginAt: engagement.lastLoginAt,
      lastMeaningfulActivityAt: engagement.lastMeaningfulActivityAt,
      activeUsersProxy: engagement.activeUsersProxy,
      limitations: engagement.limitations,
      status: engagement.status,
    },
    adoption: {
      status: CUSTOMER_READINESS.UNAVAILABLE,
      reason: 'FEATURE_USED not emitted',
    },
    mraEis: {
      entitlementStatus: mraEis.entitlementStatus,
      commercialPlan: mraEis.commercialPlan,
      operationalReadiness: mraEis.operationalReadiness,
      status: mraEis.status,
      limitations: mraEis.limitations || null,
    },
    service: {
      support: { status: CUSTOMER_READINESS.NOT_INSTRUMENTED },
      onboarding: { status: CUSTOMER_READINESS.NOT_INSTRUMENTED },
      training: { status: CUSTOMER_READINESS.NOT_INSTRUMENTED },
    },
    signals: {
      risk: signals.risk || [],
      opportunity: signals.opportunity || [],
      attention: signals.attention || [],
      status: signals.status || null,
      ruleVersion: signals.ruleVersion || CUSTOMER_SIGNAL_RULE_VERSION,
      persistence: signals.persistence || null,
      limitations: signals.limitations || null,
    },
    ownership: {
      portfolioId: ownership.portfolioId,
      portfolioCode: ownership.portfolioCode,
      portfolioName: ownership.portfolioName,
      primaryOwnerId: ownership.primaryOwnerId,
      primaryOwnerName: ownership.primaryOwnerName,
      primaryOwnerEmail: ownership.primaryOwnerEmail,
      assignments: ownership.assignments || [],
      status: ownership.status,
      limitations: ownership.limitations || null,
    },
    reliability: {
      freshness: { asOf: generatedAt, status: 'LIVE_QUERY' },
      reconciliation: null,
      dataQuality: null,
      limitations,
    },
    meta: {
      ruleVersions: {
        lifecycle: lifecycle.ruleVersion || LIFECYCLE_RULE_VERSION,
        catalogue: CUSTOMER_CATALOGUE_VERSION,
        signals: signals.ruleVersion || CUSTOMER_SIGNAL_RULE_VERSION,
      },
      lifecycleEnteredAt: lifecycle.enteredAt,
      generatedAt,
      catalogueVersion: CUSTOMER_CATALOGUE_VERSION,
      sections: CUSTOMER_SECTION_CODES,
      authz: {
        masked: access.financeMasked,
        financeOk: access.financeOk,
      },
    },
  };
}
