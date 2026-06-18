import { formatYmdInTimeZone } from './dateUtils.js';

export const REPORT_EXCLUDED_DOCUMENT_STATUSES = [
  'Draft',
  'draft',
  'DRAFT',
  'Cancelled',
  'cancelled',
  'CANCELLED',
  'Canceled',
  'canceled',
  'CANCELED',
  'Void',
  'void',
  'VOID',
  'Voided',
  'voided',
  'VOIDED',
  'Refunded',
  'refunded',
  'REFUNDED',
  'Reversed',
  'reversed',
  'REVERSED',
  'Deleted',
  'deleted',
  'DELETED',
];

export const REPORT_POSTED_STATUSES = ['posted', 'Posted', 'POSTED'];
export const REPORT_COMPLETED_STATUSES = ['Completed', 'completed', 'COMPLETED'];

export function isValidReportDocumentStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return false;
  return !new Set(REPORT_EXCLUDED_DOCUMENT_STATUSES.map((s) => s.toLowerCase())).has(normalized);
}

export function isCompletedReportStatus(status) {
  return String(status || '').trim().toLowerCase() === 'completed';
}

export function validInvoiceReportWhere(tenantId, dateField, start, end) {
  return {
    tenantId,
    status: { notIn: REPORT_EXCLUDED_DOCUMENT_STATUSES },
    voidedAt: null,
    refundedAt: null,
    isReversal: false,
    [dateField]: { gte: start, lte: end },
  };
}

/** Multi-tenant variant — pass `tenantWhereIn()` result as tenantScope. */
export function validInvoiceReportWhereScoped(tenantScope, dateField, start, end) {
  return {
    ...tenantScope,
    status: { notIn: REPORT_EXCLUDED_DOCUMENT_STATUSES },
    voidedAt: null,
    refundedAt: null,
    isReversal: false,
    [dateField]: { gte: start, lte: end },
  };
}

export function validSaleReportWhere(tenantId, dateField, start, end) {
  return {
    tenantId,
    status: { equals: 'completed', mode: 'insensitive' },
    voidedAt: null,
    refundedAt: null,
    isReversal: false,
    [dateField]: { gte: start, lte: end },
  };
}

/** Multi-tenant variant — pass `tenantWhereIn()` result as tenantScope. */
export function validSaleReportWhereScoped(tenantScope, dateField, start, end) {
  return {
    ...tenantScope,
    status: { equals: 'completed', mode: 'insensitive' },
    voidedAt: null,
    refundedAt: null,
    isReversal: false,
    [dateField]: { gte: start, lte: end },
  };
}

export function validPurchaseDocumentStatusFilter() {
  return { notIn: REPORT_EXCLUDED_DOCUMENT_STATUSES };
}

export function normalizeReportYmdParam(value) {
  const raw = String(value ?? '').trim();
  const ymd = raw.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (ymd) return ymd;
  return formatYmdInTimeZone(value ? new Date(value) : new Date());
}
