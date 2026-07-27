import { describe, it, expect } from 'vitest';
import {
  resolveSearchScopes,
  clampSearchLimit,
  sanitizeUserSearchHit,
  sanitizeAffiliateSearchHit,
  sanitizeTenantSearchHit,
} from '@/lib/admin/adminSearch';
import { assertAuditNotMutable } from '@/lib/admin/auditImmutability';

describe('adminSearch permission filtering', () => {
  it('Super Admin gets all scopes', () => {
    const scopes = resolveSearchScopes({ role: 'Super Admin', permissions: {} });
    expect(scopes).toEqual({ tenants: true, users: true, affiliates: true });
  });

  it('skips domains without view permission', () => {
    const admin = {
      role: 'Platform Support',
      permissions: {
        systemAdmin: {
          tenants: { view: true },
          users: { view: false },
        },
      },
    };
    expect(resolveSearchScopes(admin)).toEqual({
      tenants: true,
      users: false,
      affiliates: false,
    });
  });

  it('clampSearchLimit defaults to 10 and caps at 25', () => {
    expect(clampSearchLimit(undefined)).toBe(10);
    expect(clampSearchLimit(3)).toBe(3);
    expect(clampSearchLimit(100)).toBe(25);
    expect(clampSearchLimit(0)).toBe(10);
  });

  it('sanitizers never expose password/token/smtp fields', () => {
    const user = sanitizeUserSearchHit({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      password: 'secret',
      resetToken: 'tok',
    });
    expect(user).toEqual({ id: 'u1', email: 'a@b.com', name: 'A', type: 'user' });
    expect(user).not.toHaveProperty('password');

    const aff = sanitizeAffiliateSearchHit({
      id: 'a1',
      name: 'Aff',
      email: 'aff@x.com',
      referralCode: 'ABC',
      password: 'hash',
      paymentDetails: 'secret-bank',
    });
    expect(aff).toEqual({
      id: 'a1',
      name: 'Aff',
      email: 'aff@x.com',
      referralCode: 'ABC',
      type: 'affiliate',
    });
    expect(aff).not.toHaveProperty('password');
    expect(aff).not.toHaveProperty('paymentDetails');

    const tenant = sanitizeTenantSearchHit({
      id: 't1',
      name: 'Acme',
      subdomain: 'acme',
      status: 'active',
      smtpPassword: 'nope',
    });
    expect(tenant).toEqual({
      id: 't1',
      name: 'Acme',
      subdomain: 'acme',
      status: 'active',
      type: 'tenant',
    });
    expect(tenant).not.toHaveProperty('smtpPassword');
  });
});

describe('auditImmutability', () => {
  it('allows create/insert and blocks update/delete', () => {
    expect(() => assertAuditNotMutable('create')).not.toThrow();
    expect(() => assertAuditNotMutable('insert')).not.toThrow();
    expect(() => assertAuditNotMutable('update')).toThrow(/append-only/i);
    expect(() => assertAuditNotMutable('delete')).toThrow(/append-only/i);
    expect(() => assertAuditNotMutable('upsert')).toThrow(/append-only/i);
  });
});
