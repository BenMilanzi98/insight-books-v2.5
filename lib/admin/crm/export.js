/**
 * CRM export foundation — Phase 11 Wave 4.
 * JSON/CSV leads only. Requires systemAdmin.crm.export; rechecked at download.
 * Empty ≠ invent rows. No XLSX/PDF. Never export Tenant GL / payment secrets.
 */

import { preventFormulaInjection } from '@/lib/admin/exportSafety.js';
import { CRM_EXPORT_VERSION, CRM_LIST_MAX_LIMIT } from './catalogue.js';
import { resolveCrmAccess } from './authz.js';
import { listLeads } from './leads.js';

export function hasCrmExportAuditModel(prisma) {
  return typeof prisma?.crmExportAudit?.create === 'function';
}

function csvEscape(value) {
  const safe = preventFormulaInjection(value == null ? '' : value);
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   dataset?: 'leads',
 *   format?: 'json'|'csv',
 *   status?: string,
 *   limit?: number,
 * }} opts
 */
export async function buildCrmExportPack(prisma, opts = {}) {
  const access = resolveCrmAccess(opts.admin);
  if (!access.canViewLeads) {
    return {
      ok: false,
      forbidden: true,
      exportVersion: CRM_EXPORT_VERSION,
      reasonCode: 'view_leads_required',
    };
  }
  if (!access.canExport) {
    return {
      ok: false,
      forbidden: true,
      exportVersion: CRM_EXPORT_VERSION,
      reasonCode: 'export_permission_required',
      status: 'PERMISSION_RESTRICTED',
    };
  }

  const dataset = String(opts.dataset || 'leads').toLowerCase();
  const format = String(opts.format || 'json').toLowerCase();
  if (format !== 'json' && format !== 'csv') {
    return { ok: false, error: 'format must be json|csv', exportVersion: CRM_EXPORT_VERSION };
  }
  if (dataset !== 'leads') {
    return {
      ok: false,
      error: 'dataset must be leads (foundation)',
      exportVersion: CRM_EXPORT_VERSION,
    };
  }

  const limit = Math.min(
    CRM_LIST_MAX_LIMIT,
    Math.max(1, Number(opts.limit) || CRM_LIST_MAX_LIMIT)
  );

  const listed = await listLeads(prisma, {
    admin: opts.admin,
    status: opts.status,
    limit,
    offset: 0,
  });

  if (listed.forbidden) {
    return {
      ok: false,
      forbidden: true,
      exportVersion: CRM_EXPORT_VERSION,
      reasonCode: 'view_leads_required',
    };
  }
  if (!listed.ok) {
    return {
      ok: false,
      error: listed.error || 'export_list_failed',
      status: listed.status || 'UNAVAILABLE',
      exportVersion: CRM_EXPORT_VERSION,
      rows: [],
    };
  }

  const rows = Array.isArray(listed.items) ? listed.items : [];

  if (hasCrmExportAuditModel(prisma)) {
    try {
      await prisma.crmExportAudit.create({
        data: {
          dataset,
          format,
          rowCount: rows.length,
          exportedByAdminId: opts.admin?.id || null,
          at: new Date(),
        },
      });
    } catch {
      // audit optional
    }
  }

  if (format === 'json') {
    return {
      ok: true,
      exportVersion: CRM_EXPORT_VERSION,
      dataset,
      format,
      rowCount: rows.length,
      rows,
      contentType: 'application/json',
      body: JSON.stringify(
        {
          exportVersion: CRM_EXPORT_VERSION,
          dataset,
          rowCount: rows.length,
          rows,
          meta: {
            inventRowsForbidden: true,
            tenantGlExcluded: true,
            paymentSecretsExcluded: true,
          },
        },
        null,
        2
      ),
    };
  }

  const headers = [
    'id',
    'leadNumber',
    'status',
    'type',
    'title',
    'source',
    'channel',
    'ownerAdminId',
    'accountId',
    'contactId',
    'createdAt',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      headers
        .map((h) => csvEscape(r[h] == null ? '' : r[h]))
        .join(',')
    );
  }

  return {
    ok: true,
    exportVersion: CRM_EXPORT_VERSION,
    dataset,
    format,
    rowCount: rows.length,
    rows,
    contentType: 'text/csv; charset=utf-8',
    body: lines.join('\n'),
  };
}
