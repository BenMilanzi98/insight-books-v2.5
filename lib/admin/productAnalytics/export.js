/**
 * Product Analytics export foundation — JSON/CSV, permission + portfolio aware.
 */

import { preventFormulaInjection } from '@/lib/admin/exportSafety.js';
import { resolvePortfolioScope } from '@/lib/admin/customers/portfolioScope.js';
import { resolveProductAnalyticsAccess } from './authz.js';
import {
  PRODUCT_ANALYTICS_CATALOGUE_VERSION,
} from './catalogue.js';
import { buildProductAnalyticsOverviewPack } from './overview.js';
import { buildProductFunnelsPack, FUNNEL_DEFINITION_VERSION } from './funnels.js';
import { buildProductSignalsPack, PRODUCT_SIGNAL_RULE_VERSION } from './signals.js';
import {
  buildProductReconciliation,
  PRODUCT_RECON_VERSION,
} from './reconcile.js';
import { ASSOCIATION_DISCLAIMER } from './cohorts.js';

export const PRODUCT_EXPORT_VERSION = 'product-export-2026-07-29';

function csvEscape(value) {
  const safe = preventFormulaInjection(value == null ? '' : value);
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   dataset?: 'overview'|'funnels'|'signals'|'reconciliation',
 *   format?: 'json'|'csv',
 *   tenantId?: string,
 *   funnelCode?: string,
 *   now?: Date,
 * }} opts
 */
export async function buildProductAnalyticsExportPack(prisma, opts = {}) {
  const access = resolveProductAnalyticsAccess(opts.admin);
  if (!access.canView) {
    return {
      ok: false,
      forbidden: true,
      exportVersion: PRODUCT_EXPORT_VERSION,
    };
  }
  if (!access.canExport) {
    return {
      ok: false,
      forbidden: true,
      exportVersion: PRODUCT_EXPORT_VERSION,
      reasonCode: 'export_permission_required',
    };
  }

  const dataset = String(opts.dataset || 'overview').toLowerCase();
  const now = opts.now || new Date();
  const scope = await resolvePortfolioScope(prisma, opts.admin, { now });

  if (opts.tenantId) {
    const tid = String(opts.tenantId);
    if (
      scope.mode === 'none' ||
      (scope.mode === 'owned' && !(scope.tenantIds || []).includes(tid))
    ) {
      return {
        ok: false,
        forbidden: true,
        exportVersion: PRODUCT_EXPORT_VERSION,
        reasonCode: 'tenant_out_of_portfolio',
        portfolioMode: scope.mode,
      };
    }
  }

  const base = {
    ok: true,
    dataset,
    exportVersion: PRODUCT_EXPORT_VERSION,
    catalogueVersion: PRODUCT_ANALYTICS_CATALOGUE_VERSION,
    exportedAt: now.toISOString(),
    portfolioMode: scope.mode,
    limitations: [
      'Product Analytics export foundation — capped / pack-shaped, not a full dump',
      'Permission-checked (productAnalytics.export) and portfolio-aware',
      'Never includes Tenant Sale or tenant GL content',
      ASSOCIATION_DISCLAIMER,
    ],
  };

  if (dataset === 'overview') {
    const pack = await buildProductAnalyticsOverviewPack(prisma, {
      admin: opts.admin,
      now,
    });
    if (pack.forbidden) {
      return { ok: false, forbidden: true, exportVersion: PRODUCT_EXPORT_VERSION };
    }
    const rows = Object.values(pack.metrics || {}).map((m) => ({
      code: m.code,
      label: m.label,
      value: m.value,
      status: m.status,
      unit: m.unit || '',
    }));
    return { ...base, overview: pack, rows };
  }

  if (dataset === 'funnels') {
    const pack = await buildProductFunnelsPack(prisma, {
      admin: opts.admin,
      tenantId: opts.tenantId,
      funnelCode: opts.funnelCode,
      now,
    });
    if (pack.forbidden) {
      return { ok: false, forbidden: true, exportVersion: PRODUCT_EXPORT_VERSION };
    }
    const rows = (pack.definitions || []).map((d) => ({
      code: d.code,
      name: d.name,
      featureCode: d.featureCode,
      instrumented: d.instrumented,
      definitionVersion: FUNNEL_DEFINITION_VERSION,
    }));
    return { ...base, funnels: pack, rows };
  }

  if (dataset === 'signals') {
    const pack = await buildProductSignalsPack(prisma, {
      admin: opts.admin,
      tenantId: opts.tenantId,
      now,
    });
    if (pack.forbidden) {
      return { ok: false, forbidden: true, exportVersion: PRODUCT_EXPORT_VERSION };
    }
    const rows = pack.evaluation?.signals || pack.catalogue || [];
    return {
      ...base,
      signals: pack,
      rows: rows.map((r) => ({
        id: r.id || r.code,
        code: r.code,
        tenantId: r.tenantId || '',
        featureCode: r.featureCode || '',
        severity: r.severity || '',
        kind: r.kind || '',
        title: r.title || '',
        ruleVersion: r.ruleVersion || PRODUCT_SIGNAL_RULE_VERSION,
      })),
    };
  }

  if (dataset === 'reconciliation') {
    const pack = await buildProductReconciliation(prisma, {
      admin: opts.admin,
      tenantId: opts.tenantId,
      now,
    });
    if (pack.forbidden) {
      return { ok: false, forbidden: true, exportVersion: PRODUCT_EXPORT_VERSION };
    }
    return {
      ...base,
      reconciliation: pack,
      rows: (pack.features || []).map((f) => ({
        featureCode: f.featureCode,
        eventCount: f.eventCount,
        factCount: f.factCount,
        reconStatus: f.reconStatus,
        complete: f.complete,
        metricStatus: f.metricStatus,
        reconVersion: PRODUCT_RECON_VERSION,
      })),
    };
  }

  return {
    ok: false,
    error: 'dataset must be overview|funnels|signals|reconciliation',
    exportVersion: PRODUCT_EXPORT_VERSION,
  };
}

/**
 * @param {object} pack
 * @returns {string}
 */
export function formatProductAnalyticsExportCsv(pack) {
  const rows = pack?.rows || [];
  if (!rows.length) {
    return 'code,status,value\n';
  }
  const keys = Object.keys(rows[0]);
  const lines = [keys.join(',')];
  for (const row of rows) {
    lines.push(keys.map((k) => csvEscape(row[k])).join(','));
  }
  return `${lines.join('\n')}\n`;
}
