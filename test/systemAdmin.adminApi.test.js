import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  adminApi,
  adminFetch,
  AdminApiError,
  normalizeAdminResponse,
} from '@/lib/admin/adminApi';
import { createCorrelationId } from '@/lib/admin/correlation';
import { assertAdminScope, ADMIN_SCOPES } from '@/lib/admin/scopes';

describe('adminApi foundations', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('createCorrelationId returns a non-empty string', () => {
    expect(createCorrelationId().length).toBeGreaterThan(8);
  });

  it('normalizeAdminResponse wraps legacy JSON', () => {
    const out = normalizeAdminResponse({ tenants: [] }, 200, 'cid-1');
    expect(out.ok).toBe(true);
    expect(out.data).toEqual({ tenants: [] });
    expect(out.meta.legacy).toBe(true);
    expect(out.meta.correlationId).toBe('cid-1');
  });

  it('normalizeAdminResponse parses envelope success', () => {
    const out = normalizeAdminResponse(
      { ok: true, data: { n: 1 }, meta: { scope: 'PLATFORM_GLOBAL' } },
      200,
      'cid-2'
    );
    expect(out.data).toEqual({ n: 1 });
    expect(out.meta.scope).toBe('PLATFORM_GLOBAL');
  });

  it('normalizeAdminResponse throws AdminApiError on envelope failure', () => {
    expect(() =>
      normalizeAdminResponse(
        { ok: false, error: { code: 'ADMIN_FORBIDDEN', message: 'Nope', messageKey: 'admin-foundation.errors.forbidden' } },
        403,
        'cid-3'
      )
    ).toThrow(AdminApiError);
  });

  it('adminApi sends x-correlation-id and credentials', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify({ items: [] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await adminApi('/api/admin/example', { correlationId: 'fixed-cid' });
    expect(result.data).toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    expect(init.credentials).toBe('include');
    expect(init.headers['x-correlation-id']).toBe('fixed-cid');
    expect(init.cache).toBe('no-store');
  });

  it('assertAdminScope rejects silent widening', () => {
    expect(() =>
      assertAdminScope(ADMIN_SCOPES.TENANT_SCOPED, ADMIN_SCOPES.PLATFORM_GLOBAL)
    ).toThrow(/scope mismatch/i);
  });

  it('adminFetch returns Response-like ok/json for legacy bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify({ success: true }),
      }))
    );
    const res = await adminFetch('/api/admin/ping');
    expect(res.ok).toBe(true);
    expect(await res.json()).toEqual({ success: true });
  });
});
