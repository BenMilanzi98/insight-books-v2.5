import { describe, it, expect } from 'vitest';
import {
  filterCoaPostableIncomeAccounts,
  pickDefaultPostableIncomeAccount,
} from '../lib/coaIncomeAccounts.js';

describe('coa postable income accounts', () => {
  const revenueRoot = {
    id: 'root-4000',
    accountCode: '4000',
    accountName: 'Revenue',
    acceptsNewTransactions: true,
    _count: { childAccounts: 3 },
  };

  const productSales = {
    id: 'leaf-4100',
    accountCode: '4100',
    accountName: 'Product Sales',
    acceptsNewTransactions: true,
    _count: { childAccounts: 0 },
  };

  const serviceRevenue = {
    id: 'leaf-4150',
    accountCode: '4150',
    accountName: 'Service Revenue',
    acceptsNewTransactions: true,
    _count: { childAccounts: 0 },
  };

  it('filters out structural revenue root 4000', () => {
    const postable = filterCoaPostableIncomeAccounts([revenueRoot, productSales]);
    expect(postable.map((a) => a.accountCode)).toEqual(['4100']);
  });

  it('prefers 4100 over other postable leaves', () => {
    const picked = pickDefaultPostableIncomeAccount([serviceRevenue, revenueRoot, productSales]);
    expect(picked?.accountCode).toBe('4100');
  });
});
