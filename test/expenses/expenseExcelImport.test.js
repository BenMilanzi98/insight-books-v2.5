import { describe, it, expect, vi } from 'vitest';
import {
  parseWorkbookBuffer,
  dryRunExpenseImport,
  IMPORT_MODES,
} from '../../lib/expenses/expenseExcelImport.js';
import { buildExpenseWorkbookBuffer, sanitizeCell } from '../../lib/expenses/expenseExcelExport.js';

describe('expenseExcelExport sanitize', () => {
  it('escapes formula injection prefixes', () => {
    expect(sanitizeCell('=CMD()')).toBe("'=CMD()");
    expect(sanitizeCell('+1+1')).toBe("'+1+1");
    expect(sanitizeCell('-1')).toBe("'-1");
    expect(sanitizeCell('@sum')).toBe("'@sum");
    expect(sanitizeCell('Rent')).toBe('Rent');
  });
});

describe('expenseExcelImport dry-run', () => {
  it('round-trips workbook parse and dry-runs creates without writing', async () => {
    const buffer = await buildExpenseWorkbookBuffer({
      tenantId: 'tenant-a',
      expenses: [
        {
          id: '',
          date: new Date('2026-01-15'),
          description: 'Office supplies',
          category: 'Admin',
          amount: 100,
          taxAmount: 16.5,
          paymentStatus: 'Pending',
          status: 'Draft',
          accountCode: '5350',
          accountName: 'Office Supplies',
          originalReference: 'IMP-001',
        },
      ],
      payments: [],
      meta: { exportedBy: 'test@example.com' },
    });

    const sheets = await parseWorkbookBuffer(buffer);
    expect(sheets.expenses.length).toBe(1);
    expect(sheets.manifest.length).toBeGreaterThan(0);

    const db = {
      account: {
        findFirst: vi.fn(async ({ where }) => {
          const code =
            where.OR?.find((o) => o.accountCode)?.accountCode ||
            where.OR?.find((o) => o.code)?.code;
          if (code === '5350') {
            return { id: 'acct-5350', accountCode: '5350', name: 'Office Supplies' };
          }
          return null;
        }),
      },
      expense: {
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => {
          throw new Error('dry-run must not create');
        }),
      },
    };

    const result = await dryRunExpenseImport({
      tenantId: 'tenant-a',
      sheets,
      db,
      mode: IMPORT_MODES.DRAFT_ONLY_IMPORT,
    });

    expect(result.errors).toEqual([]);
    expect(result.creates).toHaveLength(1);
    expect(result.creates[0].status).toBe('Draft');
    expect(result.creates[0].expenseAccountId).toBe('acct-5350');
    expect(db.expense.create).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant manifest mismatch', async () => {
    const buffer = await buildExpenseWorkbookBuffer({
      tenantId: 'other-tenant',
      expenses: [
        {
          date: new Date('2026-01-15'),
          description: 'Cross',
          amount: 10,
          accountCode: '5350',
        },
      ],
    });
    const sheets = await parseWorkbookBuffer(buffer);
    const db = {
      account: { findFirst: vi.fn(async () => null) },
      expense: { findMany: vi.fn(async () => []) },
    };

    const result = await dryRunExpenseImport({
      tenantId: 'tenant-a',
      sheets,
      db,
    });

    expect(result.errors.some((e) => e.code === 'CROSS_TENANT_MANIFEST')).toBe(true);
    expect(result.creates).toHaveLength(0);
  });

  it('RECONCILE_EXISTING detects links only', async () => {
    const buffer = await buildExpenseWorkbookBuffer({
      tenantId: 'tenant-a',
      expenses: [
        {
          id: 'exp-1',
          date: new Date('2026-01-15'),
          description: 'Existing',
          amount: 50,
          accountCode: '5350',
          originalReference: 'REF-1',
        },
      ],
    });
    const sheets = await parseWorkbookBuffer(buffer);
    // Force reconcile mode via manifest-equivalent option
    const db = {
      account: {
        findFirst: vi.fn(async () => ({
          id: 'acct-5350',
          accountCode: '5350',
        })),
      },
      expense: {
        findMany: vi.fn(async () => [
          {
            id: 'exp-1',
            originalReference: 'REF-1',
            amount: 50,
            status: 'Approved',
            paymentStatus: 'Fully paid',
            expenseAccountId: 'acct-5350',
          },
        ]),
      },
    };

    const result = await dryRunExpenseImport({
      tenantId: 'tenant-a',
      sheets,
      db,
      mode: IMPORT_MODES.RECONCILE_EXISTING,
    });

    expect(result.mode).toBe(IMPORT_MODES.RECONCILE_EXISTING);
    expect(result.links).toHaveLength(1);
    expect(result.creates).toHaveLength(0);
  });
});
