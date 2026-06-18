import { describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  SALARY_ADVANCE_RECEIVABLE_CODE,
  ensureSalaryAdvanceReceivableCoaRow,
  resolveSalaryAdvanceReceivableAccount,
  salaryAdvanceReceivableCoaLabel,
} from '../lib/salaryAdvanceGlAccount.js';
import { mapSalaryAdvanceToRegisterRow } from '../lib/mapSalaryAdvanceRegisterRow.js';
import { tenantExistsForIntegration } from './helpers/dbIntegrationGuard.js';

const TENANT = 'cmff4eqli02h5jq2grs29src9';
const tenantReady = await tenantExistsForIntegration(TENANT);
const prisma = new PrismaClient();

describe.skipIf(!tenantReady)('salary advance receivable CoA', () => {
  it('ensures 1216 is visible and postable in chart of accounts', async () => {
    const account = await ensureSalaryAdvanceReceivableCoaRow(TENANT, prisma);
    expect(account.accountCode).toBe(SALARY_ADVANCE_RECEIVABLE_CODE);
    expect(account.visibleInChart).toBe(true);
    expect(account.acceptsNewTransactions).toBe(true);
    expect(account.accountType).toBe('Asset');
    await prisma.$disconnect();
  }, 30000);

  it('resolves the same account for advance GL postings', async () => {
    const account = await resolveSalaryAdvanceReceivableAccount(TENANT, prisma);
    expect(account.accountCode).toBe(SALARY_ADVANCE_RECEIVABLE_CODE);
    expect(salaryAdvanceReceivableCoaLabel(account)).toBe(
      '1216 - Salary Advance Receivable'
    );
    await prisma.$disconnect();
  }, 30000);

  it('maps register rows with CoA code and label', () => {
    const row = mapSalaryAdvanceToRegisterRow(
      {
        id: 'adv1',
        amount: 50000,
        advanceDate: new Date('2026-01-15'),
        repaymentMonths: 2,
        employee: { name: 'Jane Doe' },
        reference: 'SA-001',
        notes: null,
        outstandingAmount: 50000,
        totalDeducted: 0,
      },
      {
        id: 'acc-1216',
        accountCode: '1216',
        accountName: 'Salary Advance Receivable',
      }
    );
    expect(row.categoryLabel).toBe('1216 - Salary Advance Receivable');
    expect(row.accountCode).toBe('1216');
    expect(row.receivableAccountId).toBe('acc-1216');
  });
});
