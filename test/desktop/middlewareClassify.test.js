import { describe, expect, it } from 'vitest';
import { DESKTOP_CODES } from '../../lib/desktop/codes.js';
import { resolveDesktopApiMiddleware } from '../../lib/desktop/middlewareClassify.js';

describe('resolveDesktopApiMiddleware', () => {
  it('rewrites operational API paths to desktop-local', () => {
    expect(resolveDesktopApiMiddleware('/api/sales')).toEqual({
      action: 'rewrite',
      pathname: '/api/desktop-local/sales',
    });
    expect(resolveDesktopApiMiddleware('/api/pos/cash-day/open')).toEqual({
      action: 'rewrite',
      pathname: '/api/desktop-local/pos/cash-day/open',
    });
  });

  it('blocks online-only paths with DESKTOP_ONLINE_ONLY', () => {
    const result = resolveDesktopApiMiddleware('/api/payroll');
    expect(result).toEqual({
      action: 'respond',
      status: 503,
      body: {
        code: DESKTOP_CODES.ONLINE_ONLY,
        error: 'This area needs internet.',
      },
    });
  });

  it('blocks desktop-cloud paths with 404 on local runtime', () => {
    expect(resolveDesktopApiMiddleware('/api/desktop/snapshot')).toEqual({
      action: 'respond',
      status: 404,
      body: { error: 'Not found' },
    });
  });

  it('allows auth-ok and desktop-local paths through', () => {
    expect(resolveDesktopApiMiddleware('/api/auth/me')).toEqual({ action: 'next' });
    expect(resolveDesktopApiMiddleware('/api/desktop-local/sales')).toEqual({ action: 'next' });
  });
});
