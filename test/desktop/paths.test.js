import { afterEach, describe, expect, it } from 'vitest';
import { classifyDesktopApiPath } from '../../lib/desktop/paths.js';
import {
  DESKTOP_COOKIE,
  isDesktopCookie,
  isDesktopRuntime,
} from '../../lib/desktop/runtime.js';

describe('classifyDesktopApiPath', () => {
  it('marks operational API prefixes as operational', () => {
    for (const pathname of [
      '/api/sales',
      '/api/pos/cash-day/open',
      '/api/invoices/abc',
      '/api/clients/abc',
      '/api/stock/items',
      '/api/payments/abc',
    ]) {
      expect(classifyDesktopApiPath(pathname)).toBe('operational');
    }
  });

  it('checks invoice online-only exceptions before the operational prefix', () => {
    for (const pathname of [
      '/api/invoices/abc/send',
      '/api/invoices/upload',
      '/api/invoices/export',
      '/api/invoices/abc/download',
      '/api/invoices/abc/attachments',
    ]) {
      expect(classifyDesktopApiPath(pathname)).toBe('online-only');
    }
  });

  it('checks client online-only exceptions before the operational prefix', () => {
    for (const pathname of [
      '/api/clients/send-email',
      '/api/clients/bulk-upload',
      '/api/clients/template',
      '/api/clients/abc/balance-reminder',
    ]) {
      expect(classifyDesktopApiPath(pathname)).toBe('online-only');
    }
  });

  it('checks stock online-only exceptions before the operational prefix', () => {
    for (const pathname of [
      '/api/stock/receiving',
      '/api/stock/basic-import',
      '/api/stock/export',
      '/api/stock/upload-image',
      '/api/stock/basic-export',
    ]) {
      expect(classifyDesktopApiPath(pathname)).toBe('online-only');
    }
  });

  it('checks payment, sales, and POS online-only exceptions first', () => {
    for (const pathname of [
      '/api/payments/export',
      '/api/payments/sync',
      '/api/sales/export',
      '/api/sales/receipts/export',
      '/api/pos/cash-day/export',
      '/api/pos/cash-day/deposit',
    ]) {
      expect(classifyDesktopApiPath(pathname)).toBe('online-only');
    }
  });

  it('marks desktop cloud routes as desktop-cloud', () => {
    for (const pathname of [
      '/api/desktop/bind',
      '/api/desktop/unbind',
      '/api/desktop/snapshot',
      '/api/desktop/outbox',
      '/api/desktop/heartbeat',
    ]) {
      expect(classifyDesktopApiPath(pathname)).toBe('desktop-cloud');
    }
  });

  it('marks desktop local routes as desktop-local', () => {
    expect(classifyDesktopApiPath('/api/desktop-local')).toBe('desktop-local');
    expect(classifyDesktopApiPath('/api/desktop-local/status')).toBe('desktop-local');
  });

  it('allows auth and language routes needed by desktop', () => {
    for (const pathname of [
      '/api/auth/me',
      '/api/auth/logout',
      '/api/preferences/language',
      '/api/auth/page-guard',
      '/api/auth/api-guard',
    ]) {
      expect(classifyDesktopApiPath(pathname)).toBe('auth-ok');
    }
  });

  it('marks all other API paths as online-only', () => {
    expect(classifyDesktopApiPath('/api/payroll')).toBe('online-only');
    expect(classifyDesktopApiPath('/api/reports/trial-balance')).toBe('online-only');
  });
});

describe('desktop runtime helpers', () => {
  const originalDesktopRuntime = process.env.DESKTOP_RUNTIME;

  afterEach(() => {
    if (originalDesktopRuntime === undefined) {
      delete process.env.DESKTOP_RUNTIME;
    } else {
      process.env.DESKTOP_RUNTIME = originalDesktopRuntime;
    }
  });

  it('uses the required desktop cookie name and value', () => {
    expect(DESKTOP_COOKIE).toBe('ib_desktop');
    expect(isDesktopCookie('1')).toBe(true);
    expect(isDesktopCookie(1)).toBe(true);
    expect(isDesktopCookie('0')).toBe(false);
    expect(isDesktopCookie(undefined)).toBe(false);
  });

  it('enables desktop runtime only for the exact flag value', () => {
    process.env.DESKTOP_RUNTIME = '1';
    expect(isDesktopRuntime()).toBe(true);

    process.env.DESKTOP_RUNTIME = 'true';
    expect(isDesktopRuntime()).toBe(false);

    delete process.env.DESKTOP_RUNTIME;
    expect(isDesktopRuntime()).toBe(false);
  });
});
