import { describe, expect, it } from 'vitest';
import {
  classifyTenantIdentity,
  tenantMatchesExportFilter,
  tenantPaidBefore,
  normalizeTenantStatus,
} from '../lib/admin/tenantIdentity/filters.js';
import { validateTenantIdentityPackage } from '../lib/admin/tenantIdentity/validate.js';
import { FORMAT_ID } from '../lib/admin/tenantIdentity/serialize.js';
import { pickSafeSettings } from '../lib/admin/tenantIdentity/settingsFields.js';

const now = new Date('2026-07-28T12:00:00.000Z');

function sub(overrides = {}) {
  return {
    isTrial: false,
    isActive: true,
    status: 'Active',
    expiresAt: new Date('2026-12-31'),
    trialEndDate: null,
    paymentDate: new Date('2026-01-01'),
    amount: 100,
    ...overrides,
  };
}

describe('tenant identity filters', () => {
  it('normalizes lifecycle status', () => {
    expect(normalizeTenantStatus('ACTIVE')).toBe('active');
    expect(normalizeTenantStatus('SUSPENDED')).toBe('suspended');
  });

  it('detects paidBefore from non-trial history', () => {
    expect(tenantPaidBefore([sub({ isActive: false, expiresAt: new Date('2025-01-01') })])).toBe(
      true
    );
    expect(tenantPaidBefore([{ isTrial: true, amount: 0, paymentDate: null }])).toBe(false);
  });

  it('classifies active paid tenants', () => {
    const tenant = {
      id: 't1',
      status: 'active',
      accountSubscriptions: [sub()],
    };
    const c = classifyTenantIdentity(tenant, now);
    expect(c.isPaidActive).toBe(true);
    expect(c.subscriptionStatus).toBe('active');
    expect(tenantMatchesExportFilter('active', tenant, {}, now)).toBe(true);
    expect(tenantMatchesExportFilter('paid_inactive', tenant, {}, now)).toBe(false);
  });

  it('classifies paid but inactive', () => {
    const tenant = {
      id: 't2',
      status: 'active',
      accountSubscriptions: [
        sub({
          isActive: false,
          expiresAt: new Date('2025-01-01'),
          status: 'Expired',
        }),
      ],
    };
    const c = classifyTenantIdentity(tenant, now);
    expect(c.paidBefore).toBe(true);
    expect(c.isPaidActive).toBe(false);
    expect(tenantMatchesExportFilter('paid_inactive', tenant, {}, now)).toBe(true);
  });

  it('matches specific by subdomain', () => {
    const tenant = { id: 't3', subdomain: 'acme', status: 'active', accountSubscriptions: [] };
    expect(
      tenantMatchesExportFilter('specific', tenant, { subdomain: 'ACME' }, now)
    ).toBe(true);
  });

  it('excludes trial-only from active and paid_inactive', () => {
    const tenant = {
      id: 't4',
      status: 'active',
      accountSubscriptions: [
        {
          isTrial: true,
          isActive: true,
          status: 'Active',
          trialEndDate: new Date('2026-12-01'),
          expiresAt: null,
          amount: 0,
          paymentDate: null,
        },
      ],
    };
    expect(tenantMatchesExportFilter('active', tenant, {}, now)).toBe(false);
    expect(tenantMatchesExportFilter('paid_inactive', tenant, {}, now)).toBe(false);
  });
});

describe('validateTenantIdentityPackage', () => {
  it('rejects wrong format', () => {
    const r = validateTenantIdentityPackage({ format: 'nope', tenants: [] });
    expect(r.ok).toBe(false);
  });

  it('accepts minimal valid package', () => {
    const r = validateTenantIdentityPackage({
      format: FORMAT_ID,
      tenants: [
        {
          tenant: { id: 't1', name: 'Acme', subdomain: 'acme' },
          roles: [{ id: 'r1', name: 'Owner' }],
          users: [
            {
              id: 'u1',
              email: 'a@b.com',
              password: '$2a$10$abcdefghijklmnopqrstuv',
              roleId: 'r1',
            },
          ],
          memberships: [],
          subscriptions: [{ id: 's1', txRef: 'tx-1', plan: '1year', amount: 1 }],
        },
      ],
    });
    expect(r.ok).toBe(true);
  });
});

describe('pickSafeSettings', () => {
  it('omits EIS secrets', () => {
    const picked = pickSafeSettings({
      currencyCode: 'MWK',
      eisApiKey: 'secret',
      eisClientSecret: 'secret2',
      defaultTaxRate: 16.5,
    });
    expect(picked.currencyCode).toBe('MWK');
    expect(picked.eisApiKey).toBeUndefined();
    expect(picked.eisClientSecret).toBeUndefined();
  });
});
