/**
 * Customer export foundation — directory / overview JSON|CSV (Phase 7 Wave 4).
 * Platform customer plane only — never Tenant Sale.
 */

import { resolveCustomerAccess } from './authz.js';
import { CUSTOMER_CATALOGUE_VERSION } from './catalogue.js';
import { listCustomerDirectory } from './directory.js';
import { buildCustomerOverviewPack } from './overviewPack.js';

function csvEscape(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   format?: string,
 *   dataset?: 'directory'|'overview',
 *   currency?: string,
 *   q?: string,
 *   pageSize?: number,
 *   now?: Date,
 * }} opts
 */
export async function buildCustomerExportPack(prisma, opts = {}) {
  const access = resolveCustomerAccess(opts.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true, catalogueVersion: CUSTOMER_CATALOGUE_VERSION };
  }

  const now = opts.now || new Date();
  const dataset = String(opts.dataset || 'directory').toLowerCase();
  const currency = opts.currency || 'MWK';

  if (dataset === 'overview') {
    const pack = await buildCustomerOverviewPack(prisma, {
      admin: opts.admin,
      currency,
      now,
    });
    if (pack.forbidden) {
      return { ok: false, forbidden: true, catalogueVersion: CUSTOMER_CATALOGUE_VERSION };
    }
    return {
      ok: true,
      dataset: 'overview',
      catalogueVersion: CUSTOMER_CATALOGUE_VERSION,
      currency,
      exportedAt: now.toISOString(),
      overview: pack,
      rows: null,
    };
  }

  const directory = await listCustomerDirectory(prisma, {
    admin: opts.admin,
    q: opts.q || '',
    page: 1,
    pageSize: Math.min(500, Math.max(1, parseInt(String(opts.pageSize || 100), 10) || 100)),
    currency,
    now,
  });

  if (directory.forbidden) {
    return { ok: false, forbidden: true, catalogueVersion: CUSTOMER_CATALOGUE_VERSION };
  }

  return {
    ok: true,
    dataset: 'directory',
    catalogueVersion: CUSTOMER_CATALOGUE_VERSION,
    currency,
    exportedAt: now.toISOString(),
    total: directory.total,
    rows: directory.rows || [],
    limitations: [
      'Export foundation — first page of directory (capped). Not a full CRM dump.',
      'Money fields follow finance gating / masking from directory.',
      'Never includes Tenant Sale or tenant GL revenue.',
    ],
  };
}

/**
 * @param {object} pack — from buildCustomerExportPack
 * @returns {string}
 */
export function formatCustomerExportCsv(pack) {
  if (!pack || pack.dataset === 'overview') {
    const lines = [['code', 'label', 'value', 'status', 'unit'].join(',')];
    const metrics = pack?.overview?.metrics || {};
    for (const m of Object.values(metrics)) {
      if (!m) continue;
      lines.push(
        [
          csvEscape(m.code),
          csvEscape(m.label || m.code),
          csvEscape(m.value),
          csvEscape(m.status),
          csvEscape(m.unit),
        ].join(',')
      );
    }
    return `${lines.join('\n')}\n`;
  }

  const header = [
    'tenantId',
    'displayName',
    'customerReference',
    'lifecycleStage',
    'status',
    'plan',
    'mrr',
    'outstanding',
    'currency',
  ];
  const lines = [header.join(',')];
  for (const row of pack.rows || []) {
    lines.push(
      [
        csvEscape(row.tenantId),
        csvEscape(row.displayName),
        csvEscape(row.customerReference),
        csvEscape(row.lifecycleStage),
        csvEscape(row.status),
        csvEscape(row.plan),
        csvEscape(row.mrr),
        csvEscape(row.outstanding),
        csvEscape(row.currency || pack.currency),
      ].join(',')
    );
  }
  return `${lines.join('\n')}\n`;
}
