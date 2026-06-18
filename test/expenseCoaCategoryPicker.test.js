import { describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getPostableExpenseAccountOptions } from '../lib/accountingMappingRules.js';
import {
  buildExpenseStatisticsByCoaCategory,
  expenseCategoryDisplayLabel,
} from '../lib/expenseCategoryCoa.js';
import { tenantExistsForIntegration } from './helpers/dbIntegrationGuard.js';

const TENANT = 'cmff4eqli02h5jq2grs29src9';
const tenantReady = await tenantExistsForIntegration(TENANT);
const prisma = new PrismaClient();

describe.skipIf(!tenantReady)('expense CoA category picker', () => {
  it('includes standard structure expense leaves such as Utilities (5310)', async () => {
    const options = await getPostableExpenseAccountOptions(TENANT, prisma);
    const codes = new Set(options.map((o) => o.code || o.accountCode));
    expect(codes.has('5310')).toBe(true);
    expect(codes.has('5320')).toBe(true);
    expect(codes.has('5330')).toBe(true);
    expect(codes.has('5360')).toBe(true);
    expect(codes.has('5130')).toBe(true);
    expect(codes.has('5000')).toBe(false);
    expect(codes.has('5200')).toBe(false);
    await prisma.$disconnect();
  }, 30000);

  it('formats expense list category from linked CoA account', () => {
    expect(
      expenseCategoryDisplayLabel({
        category: 'Travel',
        expenseAccount: { accountCode: '5340', accountName: 'Travel & Transport' },
      })
    ).toBe('5340 - Travel & Transport');
  });

  it('builds statistics rows for every postable CoA account', () => {
    const stats = buildExpenseStatisticsByCoaCategory(
      [
        { id: 'a1', code: '5310', name: 'Utilities' },
        { id: 'a2', code: '5320', name: 'Office Supplies' },
      ],
      [{ expenseAccountId: 'a1', _sum: { amount: 1000 } }],
      1000
    );
    expect(stats).toHaveLength(2);
    expect(stats[0].category).toBe('5310 - Utilities');
    expect(stats[1].category).toBe('5320 - Office Supplies');
    expect(stats[1].amount).toBe('0.00');
  });
});
