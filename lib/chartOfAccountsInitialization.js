/**
 * Ensure a baseline Chart of Accounts (CoA) exists for a tenant.
 * This is called automatically during tenant registration/creation.
 *
 * Note: Tax inflow/outflow and other statutory accounts are handled separately
 * by `ensureDefaultTaxAccountsForTenant`.
 */

import prisma from './prisma';

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];

// Keep this list aligned with prisma/seed/chartOfAccountsSeed.ts (baseline accounts)
const ACCOUNT_BLUEPRINT = [
  // Assets
  { code: '1000', name: 'Assets', type: 'Asset', normalBalance: 'Debit', subtype: 'Group', description: 'Summary bucket for all asset accounts.' },
  { code: '1100', name: 'Cash & Bank', type: 'Asset', parentCode: '1000', subtype: 'Current Asset' },
  { code: '1110', name: 'Cash on Hand', type: 'Asset', parentCode: '1100', subtype: 'Current Asset' },
  { code: '1120', name: 'Bank Accounts', type: 'Asset', parentCode: '1100', subtype: 'Current Asset' },
  { code: '1200', name: 'Accounts Receivable', type: 'Asset', parentCode: '1000', subtype: 'Current Asset' },
  { code: '1300', name: 'Inventory', type: 'Asset', parentCode: '1000', subtype: 'Current Asset' },
  { code: '1400', name: 'Prepaid Expenses', type: 'Asset', parentCode: '1000', subtype: 'Current Asset' },
  { code: '1500', name: 'Fixed Assets', type: 'Asset', parentCode: '1000', subtype: 'Non-current Asset' },
  { code: '1510', name: 'Equipment', type: 'Asset', parentCode: '1500', subtype: 'Non-current Asset' },
  { code: '1520', name: 'Furniture & Fixtures', type: 'Asset', parentCode: '1500', subtype: 'Non-current Asset' },
  { code: '1530', name: 'Vehicles', type: 'Asset', parentCode: '1500', subtype: 'Non-current Asset' },

  // Liabilities
  { code: '2000', name: 'Liabilities', type: 'Liability', normalBalance: 'Credit', subtype: 'Group' },
  { code: '2100', name: 'Accounts Payable', type: 'Liability', parentCode: '2000', subtype: 'Current Liability' },
  { code: '2200', name: 'Accrued Expenses', type: 'Liability', parentCode: '2000', subtype: 'Current Liability' },
  { code: '2300', name: 'Short-term Loans', type: 'Liability', parentCode: '2000', subtype: 'Current Liability' },
  { code: '2400', name: 'Long-term Loans', type: 'Liability', parentCode: '2000', subtype: 'Non-current Liability' },

  // Equity
  { code: '3000', name: 'Equity', type: 'Equity', normalBalance: 'Credit', subtype: 'Group' },
  { code: '3100', name: "Owner's Capital", type: 'Equity', parentCode: '3000', subtype: 'Equity' },
  { code: '3200', name: 'Retained Earnings', type: 'Equity', parentCode: '3000', subtype: 'Equity' },
  { code: '3300', name: 'Opening Balance Adjustments', type: 'Equity', parentCode: '3000', subtype: 'Equity' },
  {
    code: '500000',
    name: 'Capital Account',
    type: 'Equity',
    parentCode: '3000',
    normalBalance: 'Credit',
    subtype: 'Capital',
    description: 'Parent GL for owner contributions; each deposit is posted to a sub-account under this code.',
    isSystem: true,
  },

  // Income (aligned with Chart of Accounts UI filters: Income, not "Revenue" type string)
  { code: '4000', name: 'Revenue', type: 'Income', normalBalance: 'Credit', subtype: 'Group' },
  { code: '4100', name: 'Sales Revenue', type: 'Income', parentCode: '4000' },
  { code: '4200', name: 'Service Revenue', type: 'Income', parentCode: '4000' },
  { code: '4300', name: 'Other Income', type: 'Income', parentCode: '4000' },

  // Expenses
  { code: '5000', name: 'Expense', type: 'Expense', normalBalance: 'Debit', subtype: 'Group' },
  { code: '5100', name: 'Cost of Goods Sold', type: 'Expense', parentCode: '5000' },
  { code: '5200', name: 'Operating Expenses', type: 'Expense', parentCode: '5000' },
  { code: '5210', name: 'Rent Expense', type: 'Expense', parentCode: '5200' },
  { code: '5220', name: 'Utilities Expense', type: 'Expense', parentCode: '5200' },
  { code: '5230', name: 'Salaries Expense', type: 'Expense', parentCode: '5200' },
  { code: '5240', name: 'Marketing & Advertising', type: 'Expense', parentCode: '5200' },
  { code: '5250', name: 'Office Supplies', type: 'Expense', parentCode: '5200' },
  { code: '5260', name: 'Professional Services', type: 'Expense', parentCode: '5200' },
  { code: '5270', name: 'Travel & Accommodation', type: 'Expense', parentCode: '5200' },
  { code: '5280', name: 'Vehicle Expenses', type: 'Expense', parentCode: '5200' },
];

function normalizeAccountType(value) {
  if (!value) return value;
  const normalized = value.toString().trim();
  if (!normalized) return normalized;
  const upper = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  if (ACCOUNT_TYPES.includes(upper)) return upper;
  return upper; // keep original if not in list
}

async function ensureAccountForTenant(tenantId, blueprint, cache, db = prisma) {
  const accountType = normalizeAccountType(blueprint.type);

  const parentAccountId = blueprint.parentCode
    ? cache.get(blueprint.parentCode) ??
      (
        await db.account.findFirst({
          where: { tenantId, accountCode: blueprint.parentCode },
          select: { id: true },
        })
      )?.id ??
      null
    : null;

  const existing = await db.account.findFirst({
    where: { tenantId, accountCode: blueprint.code },
    select: { id: true },
  });

  const baseData = {
    tenantId,
    accountCode: blueprint.code,
    accountName: blueprint.name,
    accountType,
    normalBalance:
      blueprint.normalBalance ||
      (['Asset', 'Expense'].includes(accountType) ? 'Debit' : 'Credit'),
    accountSubtype: blueprint.subtype || null,
    parentAccountId,
    description: blueprint.description || null,
    ...(blueprint.isSystem ? { isSystem: true } : {}),
  };

  if (existing) {
    await db.account.update({
      where: { id: existing.id },
      data: baseData,
    });
    cache.set(blueprint.code, existing.id);
    return;
  }

  const created = await db.account.create({
    data: baseData,
    select: { id: true },
  });

  cache.set(blueprint.code, created.id);
}

/**
 * Ensure baseline chart of accounts exists for the tenant.
 * @param {string} tenantId
 * @param {object} tx - optional Prisma transaction client
 */
export async function ensureChartOfAccountsForTenant(tenantId, tx = prisma) {
  if (!tenantId) return;

  const parentCache = new Map();
  for (const blueprint of ACCOUNT_BLUEPRINT) {
    await ensureAccountForTenant(tenantId, blueprint, parentCache, tx);
  }
}

