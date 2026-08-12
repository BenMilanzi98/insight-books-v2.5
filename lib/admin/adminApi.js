/**
 * Safe Admin control-plane fetch client.
 * Accepts envelope `{ ok, data, meta }` or legacy JSON bodies.
 */

import { createCorrelationId } from '@/lib/admin/correlation';

export class AdminApiError extends Error {
  /**
   * @param {{ message?: string, code?: string, status?: number, messageKey?: string, correlationId?: string, details?: object }} opts
   */
  constructor(opts = {}) {
    super(opts.message || 'Admin request failed');
    this.name = 'AdminApiError';
    this.code = opts.code || 'ADMIN_ERROR';
    this.status = opts.status ?? 0;
    this.messageKey = opts.messageKey || null;
    this.correlationId = opts.correlationId || null;
    this.details = opts.details || {};
  }
}

function normalizePath(path) {
  if (!path) throw new AdminApiError({ code: 'ADMIN_BAD_REQUEST', message: 'path required' });
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * @param {unknown} body
 * @param {number} status
 * @param {string} correlationId
 */
export function normalizeAdminResponse(body, status, correlationId) {
  if (body && typeof body === 'object' && 'ok' in body) {
    if (body.ok === true) {
      return {
        ok: true,
        data: body.data !== undefined ? body.data : body,
        meta: { ...(body.meta || {}), correlationId: body.meta?.correlationId || correlationId },
        error: null,
      };
    }
    const err = body.error || {};
    throw new AdminApiError({
      message: err.message || 'Request failed',
      code: err.code || 'ADMIN_ERROR',
      status,
      messageKey: err.messageKey || null,
      correlationId: err.correlationId || correlationId,
      details: err.details || {},
    });
  }

  if (status >= 400) {
    const message =
      (body && typeof body === 'object' && (body.error || body.message)) ||
      `HTTP ${status}`;
    throw new AdminApiError({
      message: typeof message === 'string' ? message : 'Request failed',
      code:
        (body && typeof body === 'object' && body.code) ||
        (status === 401 ? 'ADMIN_UNAUTHORIZED' : status === 403 ? 'ADMIN_FORBIDDEN' : 'ADMIN_HTTP_ERROR'),
      status,
      correlationId,
      details: typeof body === 'object' && body ? body : {},
    });
  }

  return {
    ok: true,
    data: body,
    meta: { correlationId, legacy: true },
    error: null,
  };
}

/**
 * @param {string} path
 * @param {{ method?: string, body?: unknown, headers?: Record<string,string>, correlationId?: string, idempotencyKey?: string, signal?: AbortSignal, throwOnError?: boolean }} [options]
 */
export async function adminApi(path, options = {}) {
  const correlationId = options.correlationId || createCorrelationId();
  const throwOnError = options.throwOnError !== false;
  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    Accept: 'application/json',
    'x-correlation-id': correlationId,
    ...(options.headers || {}),
  };
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  let body;
  if (options.body !== undefined && options.body !== null) {
    if (typeof FormData !== 'undefined' && options.body instanceof FormData) {
      body = options.body;
    } else {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }
  }

  const res = await fetch(normalizePath(path), {
    method,
    credentials: 'include',
    headers,
    body,
    signal: options.signal,
    cache: 'no-store',
  });

  const responseCorrelation =
    res.headers.get('x-correlation-id') || res.headers.get('x-request-id') || correlationId;

  let parsed = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      if (!res.ok) {
        const err = new AdminApiError({
          message: text.slice(0, 200) || `HTTP ${res.status}`,
          code: 'ADMIN_HTTP_ERROR',
          status: res.status,
          correlationId: responseCorrelation,
        });
        if (throwOnError) throw err;
        return { ok: false, data: null, meta: { correlationId: responseCorrelation }, error: err };
      }
      parsed = text;
    }
  }

  try {
    return normalizeAdminResponse(parsed, res.status, responseCorrelation);
  } catch (err) {
    if (throwOnError) throw err;
    return {
      ok: false,
      data: null,
      meta: { correlationId: responseCorrelation },
      error: err,
    };
  }
}

/**
 * Fetch-compatible wrapper for gradual page migration.
 * Returns a Response-like object; always uses credentials + correlation.
 * @param {string} input
 * @param {RequestInit} [init]
 */
export async function adminFetch(input, init = {}) {
  const method = (init.method || 'GET').toUpperCase();
  let body = init.body;
  if (typeof body === 'string' && (init.headers?.['Content-Type'] || '').includes('application/json')) {
    try {
      body = JSON.parse(body);
    } catch {
      /* keep raw string */
    }
  }

  const headers =
    init.headers && typeof init.headers.forEach === 'function'
      ? Object.fromEntries(init.headers.entries())
      : { ...(init.headers || {}) };

  const result = await adminApi(String(input), {
    method,
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
    headers,
    signal: init.signal,
    throwOnError: false,
  });

  const status = result.ok ? 200 : result.error?.status || 500;
  const headerBag = {
    'x-correlation-id': result.meta?.correlationId || result.error?.correlationId || null,
  };
  return {
    ok: result.ok,
    status,
    headers: {
      get: (name) => {
        const key = String(name || '').toLowerCase();
        return Object.prototype.hasOwnProperty.call(headerBag, key) ? headerBag[key] : null;
      },
      entries() {
        return Object.entries(headerBag).filter(([, v]) => v != null)[Symbol.iterator]();
      },
      forEach(callback, thisArg) {
        for (const [key, value] of Object.entries(headerBag)) {
          if (value != null) callback.call(thisArg, value, key, this);
        }
      },
    },
    async json() {
      return result.data;
    },
    async text() {
      return result.data == null ? '' : JSON.stringify(result.data);
    },
  };
}

export default adminApi;
