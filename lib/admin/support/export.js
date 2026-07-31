/**
 * Support export foundation — JSON/CSV only.
 * Requires systemAdmin.support.export; rechecked at download time.
 * Empty result ≠ invent rows. No XLSX/PDF.
 */

import { preventFormulaInjection } from '@/lib/admin/exportSafety.js';
import { SUPPORT_EXPORT_VERSION, SUPPORT_LIST_MAX_LIMIT } from './catalogue.js';
import { resolveSupportAccess } from './authz.js';
import { listTickets } from './tickets.js';

export function hasSupportExportAuditModel(prisma) {
  return typeof prisma?.supportExportAudit?.create === 'function';
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
 *   dataset?: 'tickets',
 *   format?: 'json'|'csv',
 *   status?: string,
 *   limit?: number,
 *   now?: Date,
 * }} opts
 */
export async function buildSupportExportPack(prisma, opts = {}) {
  const access = resolveSupportAccess(opts.admin);
  if (!access.canViewTickets) {
    return {
      ok: false,
      forbidden: true,
      exportVersion: SUPPORT_EXPORT_VERSION,
      reasonCode: 'view_tickets_required',
    };
  }
  /** Recheck export permission at download time. */
  if (!access.canExport) {
    return {
      ok: false,
      forbidden: true,
      exportVersion: SUPPORT_EXPORT_VERSION,
      reasonCode: 'export_permission_required',
      status: 'PERMISSION_RESTRICTED',
    };
  }

  const dataset = String(opts.dataset || 'tickets').toLowerCase();
  const format = String(opts.format || 'json').toLowerCase();
  if (format !== 'json' && format !== 'csv') {
    return { ok: false, error: 'format must be json|csv', exportVersion: SUPPORT_EXPORT_VERSION };
  }
  if (dataset !== 'tickets') {
    return {
      ok: false,
      error: 'dataset must be tickets (foundation)',
      exportVersion: SUPPORT_EXPORT_VERSION,
    };
  }

  const limit = Math.min(
    SUPPORT_LIST_MAX_LIMIT,
    Math.max(1, Number(opts.limit) || SUPPORT_LIST_MAX_LIMIT)
  );

  const listed = await listTickets(prisma, {
    admin: opts.admin,
    status: opts.status,
    limit,
    offset: 0,
  });

  if (listed.forbidden) {
    return {
      ok: false,
      forbidden: true,
      exportVersion: SUPPORT_EXPORT_VERSION,
      reasonCode: 'view_tickets_required',
    };
  }
  if (!listed.ok) {
    return {
      ok: false,
      error: listed.error || 'export_list_failed',
      status: listed.status || 'UNAVAILABLE',
      exportVersion: SUPPORT_EXPORT_VERSION,
      rows: [],
    };
  }

  const rows = Array.isArray(listed.items) ? listed.items : [];

  if (hasSupportExportAuditModel(prisma)) {
    try {
      await prisma.supportExportAudit.create({
        data: {
          adminId: opts.admin?.id || null,
          dataset,
          format,
          rowCount: rows.length,
        },
      });
    } catch {
      // audit soft-fail — still return export
    }
  }

  const pack = {
    ok: true,
    dataset,
    format,
    exportVersion: SUPPORT_EXPORT_VERSION,
    exportedAt: (opts.now || new Date()).toISOString(),
    rowCount: rows.length,
    rows,
    limitations: [
      'Support export foundation — capped ticket list, not a full dump',
      'Permission-checked (systemAdmin.support.export) at download time',
      'Empty result returns zero rows — never invents tickets',
      'XLSX/PDF not offered',
      'Never includes Tenant GL, MRA credentials, or payment secrets',
    ],
  };

  if (format === 'csv') {
    pack.csv = ticketsToCsv(rows);
    pack.contentType = 'text/csv; charset=utf-8';
  } else {
    pack.contentType = 'application/json; charset=utf-8';
  }

  return pack;
}

function ticketsToCsv(rows) {
  const headers = [
    'id',
    'ticketNumber',
    'tenantId',
    'status',
    'type',
    'priority',
    'queueCode',
    'sourceChannel',
    'title',
    'assigneeAdminId',
    'createdAt',
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.ticketNumber,
        row.tenantId,
        row.status,
        row.type,
        row.priority,
        row.queueCode,
        row.sourceChannel,
        row.title,
        row.assigneeAdminId,
        row.createdAt,
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  return `${lines.join('\n')}\n`;
}

export { csvEscape };
