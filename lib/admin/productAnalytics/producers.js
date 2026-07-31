/**
 * Wave 1 commerce producers — idempotent emits into Phase 4 AnalyticsOutbox.
 * Payloads: IDs / classifications only — no Tenant GL lines, no MRA credentials.
 */

import { appendAnalyticsOutbox } from '@/lib/admin/analytics/outbox.js';
import { ANALYTICS_EVENT_TYPES, SCAFFOLD_ONLY } from '@/lib/admin/analytics/catalogue.js';
import {
  INSTRUMENTED_FEATURE_CODES,
  PRODUCT_FEATURE_CODES,
  FEATURE_EVENT_CODES,
  isInstrumentedFeature,
} from '@/lib/admin/productCatalogue/features.js';

async function safeAppend(db, input) {
  try {
    if (!db || typeof db.analyticsOutbox?.create !== 'function') {
      return { ok: false, skipped: true, reason: 'analytics_unavailable' };
    }
    return await appendAnalyticsOutbox(db, input);
  } catch (e) {
    console.warn('[productAnalytics.producers]', e?.message || e);
    return { ok: false, error: e?.message || 'emit failed' };
  }
}

/**
 * Generic gate for product meaningful actions — never FEATURE_USED free-for-all.
 *
 * @param {object} prisma
 * @param {{
 *   eventCode: string,
 *   tenantId: string,
 *   featureCode: string,
 *   sourceType: string,
 *   sourceId: string,
 *   idempotencyKey: string,
 *   actorId?: string|null,
 *   correlationId?: string|null,
 *   occurredAt?: Date,
 *   payload?: object,
 * }} args
 */
export async function emitProductMeaningfulAction(prisma, args = {}) {
  const {
    eventCode,
    tenantId,
    featureCode,
    sourceType,
    sourceId,
    idempotencyKey,
    actorId = null,
    correlationId = null,
    occurredAt = new Date(),
    payload = {},
  } = args;

  if (!eventCode || !tenantId || !featureCode || !sourceType || !sourceId || !idempotencyKey) {
    return {
      ok: false,
      error: 'eventCode, tenantId, featureCode, sourceType, sourceId, idempotencyKey required',
    };
  }

  if (SCAFFOLD_ONLY.has(eventCode) || eventCode === ANALYTICS_EVENT_TYPES.FEATURE_USED) {
    return {
      ok: false,
      error: `Event type ${eventCode} is scaffold-only — use typed commerce event codes`,
      reason: 'scaffold_only',
    };
  }

  if (!isInstrumentedFeature(featureCode)) {
    return {
      ok: false,
      error: `Feature ${featureCode} is not instrumented`,
      reason: 'feature_not_instrumented',
    };
  }

  const expected = FEATURE_EVENT_CODES[featureCode];
  if (expected && expected !== eventCode) {
    return {
      ok: false,
      error: `Event ${eventCode} does not match feature ${featureCode}`,
      reason: 'event_feature_mismatch',
    };
  }

  return safeAppend(prisma, {
    tenantId,
    aggregateType: sourceType,
    aggregateId: String(sourceId),
    eventType: eventCode,
    idempotencyKey,
    actorType: actorId ? 'user' : null,
    actorId,
    correlationId,
    occurredAt,
    payload: {
      featureCode,
      sourceType,
      sourceId: String(sourceId),
      ...sanitizeProductPayload(payload),
    },
  });
}

function sanitizeProductPayload(payload) {
  if (!payload || typeof payload !== 'object') return {};
  const out = {};
  const allow = [
    'status',
    'outcome',
    'snapshotId',
    'branchId',
    'moduleCode',
    'classification',
    'environment',
  ];
  for (const k of allow) {
    if (payload[k] != null) out[k] = payload[k];
  }
  return out;
}

/**
 * Sales invoice posted (non-draft). Idempotent on invoiceId.
 */
export async function emitSalesInvoicePosted(db, {
  tenantId,
  invoiceId,
  actorId = null,
  occurredAt = new Date(),
  status = null,
  branchId = null,
} = {}) {
  if (!tenantId || !invoiceId) {
    return { ok: false, error: 'tenantId and invoiceId required' };
  }
  // Fail-closed: require explicit posted evidence — omit/unknown must not emit.
  if (status == null || String(status).trim() === '') {
    return { ok: false, skipped: true, reason: 'status_required' };
  }
  const s = String(status).trim();
  if (
    s === 'Draft' ||
    s.toUpperCase() === 'PROFORMA' ||
    s.toUpperCase() === 'UNKNOWN'
  ) {
    return { ok: false, skipped: true, reason: 'not_posted' };
  }
  return emitProductMeaningfulAction(db, {
    eventCode: ANALYTICS_EVENT_TYPES.SALES_INVOICE_POSTED,
    tenantId,
    featureCode: PRODUCT_FEATURE_CODES.INVOICES_POST,
    sourceType: 'Invoice',
    sourceId: invoiceId,
    idempotencyKey: `evt:SALES_INVOICE_POSTED:${invoiceId}`,
    actorId,
    occurredAt,
    payload: { status: s, branchId, moduleCode: 'invoices' },
  });
}

/**
 * POS transaction completed. Idempotent on saleId. Skips drafts / non-completed.
 */
export async function emitPosTransactionCompleted(db, {
  tenantId,
  saleId,
  actorId = null,
  occurredAt = new Date(),
  status = 'completed',
  branchId = null,
} = {}) {
  if (!tenantId || !saleId) {
    return { ok: false, error: 'tenantId and saleId required' };
  }
  if (String(status).toLowerCase() !== 'completed') {
    return { ok: false, skipped: true, reason: 'not_completed' };
  }
  return emitProductMeaningfulAction(db, {
    eventCode: ANALYTICS_EVENT_TYPES.POS_TRANSACTION_COMPLETED,
    tenantId,
    featureCode: PRODUCT_FEATURE_CODES.SALES_POS_COMPLETE,
    sourceType: 'Sale',
    sourceId: saleId,
    idempotencyKey: `evt:POS_TRANSACTION_COMPLETED:${saleId}`,
    actorId,
    occurredAt,
    payload: { status: 'completed', branchId, moduleCode: 'sales' },
  });
}

/**
 * MRA EIS accepted fiscal transmission only.
 * Excludes retries, rejects, reprints (isRetry / accepted=false).
 */
export async function emitMraEisTransactionAccepted(db, {
  tenantId,
  transmissionId,
  accepted = false,
  isRetry = false,
  isReprint = false,
  outcome = null,
  snapshotId = null,
  actorId = null,
  occurredAt = new Date(),
  environment = null,
} = {}) {
  if (!tenantId || !transmissionId) {
    return { ok: false, error: 'tenantId and transmissionId required' };
  }
  if (!accepted) {
    return { ok: false, skipped: true, reason: 'not_accepted' };
  }
  if (isRetry || isReprint) {
    return { ok: false, skipped: true, reason: 'retry_or_reprint_excluded' };
  }
  const outcomeUpper = outcome != null ? String(outcome).toUpperCase() : '';
  if (outcomeUpper.includes('REJECT')) {
    return { ok: false, skipped: true, reason: 'rejected' };
  }

  return emitProductMeaningfulAction(db, {
    eventCode: ANALYTICS_EVENT_TYPES.MRA_EIS_TRANSACTION_ACCEPTED,
    tenantId,
    featureCode: PRODUCT_FEATURE_CODES.EIS_FISCAL_ACCEPT,
    sourceType: 'MraEisTransmission',
    sourceId: transmissionId,
    idempotencyKey: `evt:MRA_EIS_TRANSACTION_ACCEPTED:${transmissionId}`,
    actorId,
    occurredAt,
    payload: {
      snapshotId,
      classification: 'ACCEPTED',
      environment,
      moduleCode: 'eis',
    },
  });
}

export { INSTRUMENTED_FEATURE_CODES };
