import { describe, it, expect } from 'vitest';
import {
  parseDashboardTenantScope,
  tenantWhereIn,
  userForDashboardBranchFilter,
} from '../lib/dashboardTenantScope.js';
import {
  buildReportScopeMetadata,
  filterAuthorizedTenantIds,
  parseReportingCurrencyParam,
} from '../lib/reportTenantScope.js';

describe('parseDashboardTenantScope', () => {
  const user = { id: 'u1', tenantId: 't-session' };
  const accessible = ['t-session', 't-other', 't-third'];

  it('defaults to session tenant when no scope params', () => {
    const params = new URLSearchParams();
    const result = parseDashboardTenantScope(params, user, accessible);
    expect(result.ok).toBe(true);
    expect(result.tenantIds).toEqual(['t-session']);
    expect(result.branchScoped).toBe(true);
  });

  it('supports aggregate=all for all accessible tenants', () => {
    const params = new URLSearchParams({ aggregate: 'all' });
    const result = parseDashboardTenantScope(params, user, accessible);
    expect(result.ok).toBe(true);
    expect(result.tenantIds).toEqual(accessible);
    expect(result.branchScoped).toBe(false);
  });

  it('filters tenantIds to accessible set only', () => {
    const params = new URLSearchParams({
      tenantIds: 't-other,forbidden,t-session',
    });
    const result = parseDashboardTenantScope(params, user, accessible);
    expect(result.ok).toBe(true);
    expect(result.tenantIds).toEqual(['t-other', 't-session']);
    expect(result.branchScoped).toBe(false);
  });

  it('rejects when no permitted tenants remain', () => {
    const params = new URLSearchParams({ tenantIds: 'forbidden-1,forbidden-2' });
    const result = parseDashboardTenantScope(params, user, accessible);
    expect(result.ok).toBe(false);
  });
});

describe('tenantWhereIn', () => {
  it('returns single tenant equality clause', () => {
    expect(tenantWhereIn(['t1'])).toEqual({ tenantId: 't1' });
  });

  it('returns in-clause for multiple tenants', () => {
    expect(tenantWhereIn(['t1', 't2'])).toEqual({ tenantId: { in: ['t1', 't2'] } });
  });
});

describe('buildReportScopeMetadata', () => {
  it('labels single vs multi business scope', () => {
    const tenants = [
      { id: 't1', name: 'Alpha Ltd' },
      { id: 't2', name: 'Beta Co' },
    ];
    const single = buildReportScopeMetadata(tenants, {
      tenantIds: ['t1'],
      branchScoped: true,
    });
    expect(single.mode).toBe('single');
    expect(single.businessLabel).toBe('Alpha Ltd');

    const multi = buildReportScopeMetadata(tenants, {
      tenantIds: ['t1', 't2'],
      branchScoped: false,
    });
    expect(multi.mode).toBe('multi');
    expect(multi.businessLabel).toBe('Alpha Ltd, Beta Co');
  });
});

describe('filterAuthorizedTenantIds', () => {
  it('drops unauthorized tenant ids', () => {
    expect(filterAuthorizedTenantIds(['a', 'b', 'c'], ['a', 'c'])).toEqual(['a', 'c']);
  });
});

describe('parseReportingCurrencyParam', () => {
  it('accepts valid ISO currency codes', () => {
    const params = new URLSearchParams({ reportingCurrency: 'usd' });
    expect(parseReportingCurrencyParam(params)).toBe('USD');
  });

  it('returns null for invalid values', () => {
    expect(parseReportingCurrencyParam(new URLSearchParams())).toBeNull();
    expect(parseReportingCurrencyParam(new URLSearchParams({ reportingCurrency: 'DOLLAR' }))).toBeNull();
  });
});

describe('userForDashboardBranchFilter', () => {
  const user = { id: 'u1', currentBranchId: 'b1', allowedBranchIds: ['b1'] };

  it('preserves branch when branchScoped', () => {
    expect(userForDashboardBranchFilter(user, true)).toBe(user);
  });

  it('clears branch when multi-tenant', () => {
    const filtered = userForDashboardBranchFilter(user, false);
    expect(filtered.currentBranchId).toBeNull();
    expect(filtered.allowedBranchIds).toBeNull();
  });
});
