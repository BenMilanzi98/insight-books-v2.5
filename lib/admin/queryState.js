/**
 * URL search-param helpers for admin list filters / date range / pagination.
 */

import { ADMIN_SCOPES, assertAdminScope } from '@/lib/admin/scopes';

/**
 * @param {URLSearchParams|string} input
 * @param {{ requiredScope?: string, expectedScope?: string }} [opts]
 */
export function parseAdminQueryState(input, opts = {}) {
  const params =
    typeof input === 'string' ? new URLSearchParams(input) : new URLSearchParams(input?.toString?.() || '');

  if (opts.requiredScope) {
    assertAdminScope(opts.requiredScope, opts.expectedScope || params.get('scope'));
  }

  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(params.get('pageSize') || '20', 10) || 20));

  return {
    q: params.get('q') || '',
    page,
    pageSize,
    from: params.get('from') || '',
    to: params.get('to') || '',
    scope: params.get('scope') || '',
    tenantId: params.get('tenantId') || '',
    sort: params.get('sort') || '',
    order: params.get('order') === 'asc' ? 'asc' : 'desc',
  };
}

/**
 * @param {Record<string, unknown>} state
 * @returns {URLSearchParams}
 */
export function serializeAdminQueryState(state = {}) {
  const params = new URLSearchParams();
  const setIf = (k, v) => {
    if (v == null || v === '') return;
    params.set(k, String(v));
  };
  setIf('q', state.q);
  if (state.page && Number(state.page) > 1) setIf('page', state.page);
  if (state.pageSize && Number(state.pageSize) !== 20) setIf('pageSize', state.pageSize);
  setIf('from', state.from);
  setIf('to', state.to);
  setIf('scope', state.scope);
  setIf('tenantId', state.tenantId);
  setIf('sort', state.sort);
  if (state.order && state.order !== 'desc') setIf('order', state.order);
  return params;
}

export { ADMIN_SCOPES };
