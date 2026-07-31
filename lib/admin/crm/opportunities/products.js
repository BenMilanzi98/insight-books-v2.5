/**
 * Opportunity Products — Phase 12 Wave 2.
 * Non-binding estimate lines referencing Phase 9 catalogue codes where known.
 * Never create Subscription entitlements / Invoice lines / POS stock.
 */

import {
  getProductFeature,
  listProductFeatures,
} from '@/lib/admin/productCatalogue/features.js';
import { getProductModule } from '@/lib/admin/productCatalogue/modules.js';
import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import { hasCrmOpportunityModel } from './model.js';

export const OPPORTUNITY_PRODUCT_BINDING = Object.freeze({
  NON_BINDING_ESTIMATE: 'NON_BINDING_ESTIMATE',
});

export function hasCrmOpportunityProductModel(prisma) {
  return typeof prisma?.crmOpportunityProduct?.findMany === 'function';
}

function serializeProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    opportunityId: row.opportunityId,
    featureCode: row.featureCode || null,
    moduleCode: row.moduleCode || null,
    label: row.label || null,
    quantity: row.quantity != null ? Number(row.quantity) : 1,
    unitAmountEstimate:
      row.unitAmountEstimate != null ? String(row.unitAmountEstimate) : null,
    currency: row.currency || null,
    binding: OPPORTUNITY_PRODUCT_BINDING.NON_BINDING_ESTIMATE,
    createsEntitlement: false,
    createsSubscriptionLine: false,
    createsInvoiceLine: false,
    unknownInterest: Boolean(row.unknownInterest),
    note: row.note || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

async function loadOpportunity(prisma, opportunityId) {
  const id = opportunityId ? String(opportunityId).trim() : '';
  if (!id) return null;
  try {
    if (/^OPP-\d{4}-\d{6}$/.test(id)) {
      return await prisma.crmOpportunity.findUnique({ where: { opportunityNumber: id } });
    }
    return await prisma.crmOpportunity.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/**
 * Resolve catalogue feature/module; allow explicit unknown interest.
 */
export function resolveCatalogueProductRef(args = {}) {
  const featureCode =
    args.featureCode != null ? String(args.featureCode).trim() : '';
  const moduleCode =
    args.moduleCode != null ? String(args.moduleCode).trim() : '';
  const unknownInterest = Boolean(args.unknownInterest);

  if (unknownInterest) {
    return {
      ok: true,
      unknownInterest: true,
      featureCode: null,
      moduleCode: null,
      label: args.label != null ? String(args.label).trim() || 'Unknown product interest' : 'Unknown product interest',
    };
  }

  if (featureCode) {
    const feature = getProductFeature(featureCode);
    if (!feature) {
      return { ok: false, error: 'unknown_feature_code', featureCode };
    }
    return {
      ok: true,
      unknownInterest: false,
      featureCode: feature.code,
      moduleCode: feature.moduleCode,
      label: args.label != null ? String(args.label).trim() || feature.name : feature.name,
    };
  }

  if (moduleCode) {
    const mod = getProductModule(moduleCode);
    if (!mod) {
      return { ok: false, error: 'unknown_module_code', moduleCode };
    }
    return {
      ok: true,
      unknownInterest: false,
      featureCode: null,
      moduleCode: mod.code,
      label: args.label != null ? String(args.label).trim() || mod.name : mod.name,
    };
  }

  return { ok: false, error: 'featureCode_moduleCode_or_unknownInterest_required' };
}

export async function listOpportunityProducts(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_view_forbidden' };
  }
  if (!hasCrmOpportunityModel(prisma)) {
    return { ok: false, error: 'crm_opportunity_model_unavailable', status: 'UNAVAILABLE' };
  }
  if (!hasCrmOpportunityProductModel(prisma)) {
    return { ok: false, error: 'crm_opportunity_product_model_unavailable', status: 'UNAVAILABLE' };
  }

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_scope_denied' };
  }

  const opp = await loadOpportunity(prisma, args.opportunityId);
  if (!opp) return { ok: false, notFound: true, error: 'opportunity_not_found' };

  const rows = await prisma.crmOpportunityProduct.findMany({
    where: { opportunityId: opp.id },
    orderBy: { createdAt: 'asc' },
  });

  return {
    ok: true,
    opportunityId: opp.id,
    products: (rows || []).map(serializeProduct),
    binding: OPPORTUNITY_PRODUCT_BINDING.NON_BINDING_ESTIMATE,
    createsEntitlement: false,
  };
}

/**
 * Add a non-binding Opportunity product line.
 */
export async function addOpportunityProduct(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canEditOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_edit_forbidden' };
  }
  if (!hasCrmOpportunityModel(prisma)) {
    return { ok: false, error: 'crm_opportunity_model_unavailable', status: 'UNAVAILABLE' };
  }
  if (!hasCrmOpportunityProductModel(prisma)) {
    return { ok: false, error: 'crm_opportunity_product_model_unavailable', status: 'UNAVAILABLE' };
  }

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_scope_denied' };
  }

  const opp = await loadOpportunity(prisma, args.opportunityId);
  if (!opp) return { ok: false, notFound: true, error: 'opportunity_not_found' };

  const resolved = resolveCatalogueProductRef(args);
  if (!resolved.ok) return resolved;

  let quantity = args.quantity != null ? Number(args.quantity) : 1;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: 'quantity_must_be_positive' };
  }

  let unitAmountEstimate = null;
  let currency = null;
  if (args.unitAmountEstimate != null && args.unitAmountEstimate !== '') {
    const n = Number(args.unitAmountEstimate);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: 'unitAmountEstimate_invalid' };
    }
    unitAmountEstimate = n;
    currency =
      args.currency != null ? String(args.currency).trim().toUpperCase() : '';
    if (!/^[A-Z]{3}$/.test(currency)) {
      return { ok: false, error: 'currency_required_for_amount', detail: 'ISO_4217' };
    }
  }

  const now = args.now || new Date();
  const row = await prisma.crmOpportunityProduct.create({
    data: {
      opportunityId: opp.id,
      featureCode: resolved.featureCode,
      moduleCode: resolved.moduleCode,
      label: resolved.label,
      quantity,
      unitAmountEstimate,
      currency,
      binding: OPPORTUNITY_PRODUCT_BINDING.NON_BINDING_ESTIMATE,
      unknownInterest: resolved.unknownInterest,
      note: args.note != null ? String(args.note) : null,
      createdByAdminId: args.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    product: serializeProduct(row),
    createsEntitlement: false,
    createsSubscriptionLine: false,
    createsInvoiceLine: false,
    catalogueFeatureCount: listProductFeatures().length,
  };
}
