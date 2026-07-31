/**
 * Optional admin API success/error envelopes.
 */

import { createCorrelationId } from '@/lib/admin/correlation';

/**
 * @param {object} data
 * @param {{ correlationId?: string, scope?: string, [key: string]: unknown }} [meta]
 */
export function adminOk(data, meta = {}) {
  const correlationId = meta.correlationId || createCorrelationId();
  return {
    ok: true,
    data,
    meta: { ...meta, correlationId },
  };
}

/**
 * @param {{ code: string, messageKey?: string, message?: string, details?: object, correlationId?: string, status?: number }} error
 */
export function adminFail(error = {}) {
  const correlationId = error.correlationId || createCorrelationId();
  return {
    ok: false,
    error: {
      code: error.code || 'ADMIN_ERROR',
      messageKey: error.messageKey || null,
      message: error.message || 'Request failed',
      details: error.details || {},
      correlationId,
    },
  };
}
