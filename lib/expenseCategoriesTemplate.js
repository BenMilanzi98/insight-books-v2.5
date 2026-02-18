/**
 * Single source of truth for standard expense accounts (5000-5999).
 * Used by: Chart of Accounts import template, Categories API (to ensure dropdown is always populated).
 */
export const EXPENSE_ACCOUNTS_TEMPLATE = [
  { code: '5000', name: 'Expense', type: 'Expense', subtype: 'Expense', normalBalance: 'Debit', parentCode: null },
  { code: '5001', name: 'Cost of Goods Sold', type: 'Expense', subtype: 'Cost of Sales', normalBalance: 'Debit', parentCode: '5000' },
  { code: '5002', name: 'Raw Material', type: 'Expense', subtype: 'Cost of Sales', normalBalance: 'Debit', parentCode: '5000' },
  { code: '5003', name: 'Freight In', type: 'Expense', subtype: 'Cost of Sales', normalBalance: 'Debit', parentCode: '5000' },
  { code: '5004', name: 'Purchase Returns', type: 'Expense', subtype: 'Cost of Sales', normalBalance: 'Credit', parentCode: '5000' },
  { code: '5100', name: 'Operating Expenses', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5000' },
  { code: '5110', name: 'Salaries & Wages Expense', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5100' },
  { code: '5115', name: 'Labour', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5100' },
  { code: '5120', name: 'Rent Expense', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5100' },
  { code: '5130', name: 'Utilities Expense', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5100' },
  { code: '5131', name: 'Electricity', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5130' },
  { code: '5132', name: 'Water', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5130' },
  { code: '5133', name: 'Internet & Phone', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5130' },
  { code: '5140', name: 'Office Supplies Expense', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5100' },
  { code: '5150', name: 'Marketing & Advertising Expense', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5100' },
  { code: '5160', name: 'Insurance Expense', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5100' },
  { code: '5170', name: 'Repairs & Maintenance', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5100' },
  { code: '5180', name: 'Professional Fees', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5100' },
  { code: '5181', name: 'Accounting Fees', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5180' },
  { code: '5182', name: 'Legal Fees', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5180' },
  { code: '5190', name: 'Bank Charges', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5100' },
  { code: '5195', name: 'Depreciation Expense', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5100' },
  { code: '5196', name: 'Bad Debt Expense', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5100' },
  { code: '5197', name: 'Travel & Entertainment', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5100' },
  { code: '5198', name: 'Transportation', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5100' },
  { code: '5199', name: 'Fuel & Vehicle Expenses', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5100' },
  { code: '5200', name: 'Training & Development', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5100' },
  { code: '5205', name: 'Equipment', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5100' },
  { code: '5210', name: 'Miscellaneous Expenses', type: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', parentCode: '5100' },
  { code: '5900', name: 'Other Expenses', type: 'Expense', subtype: 'Other Expense', normalBalance: 'Debit', parentCode: '5000' },
  { code: '5910', name: 'Interest Expense', type: 'Expense', subtype: 'Other Expense', normalBalance: 'Debit', parentCode: '5900' },
  { code: '5920', name: 'Loss on Sale of Assets', type: 'Expense', subtype: 'Other Expense', normalBalance: 'Debit', parentCode: '5900' },
  { code: '5930', name: 'Tax Expense', type: 'Expense', subtype: 'Other Expense', normalBalance: 'Debit', parentCode: '5900' }
];

/**
 * Ensure all standard expense accounts exist for a tenant (create if missing).
 * Call this when categories are requested so the expense dropdown is always populated.
 */
export async function ensureExpenseAccountsForTenant(tenantId, prismaClient) {
  const prisma = prismaClient || (await import('@/lib/prisma')).default;
  const accountMap = new Map();

  for (const template of EXPENSE_ACCOUNTS_TEMPLATE) {
    const existing = await prisma.account.findFirst({
      where: { tenantId, accountCode: template.code },
      select: { id: true }
    });
    if (existing) {
      accountMap.set(template.code, existing.id);
      continue;
    }
    const parentId = template.parentCode ? accountMap.get(template.parentCode) ?? null : null;
    const created = await prisma.account.create({
      data: {
        tenantId,
        accountCode: template.code,
        accountName: template.name,
        accountType: template.type,
        accountSubtype: template.subtype || null,
        normalBalance: template.normalBalance,
        parentAccountId: parentId,
        description: null,
        isActive: true,
        isSystem: true,
        balance: 0
      }
    });
    accountMap.set(template.code, created.id);
  }
}
