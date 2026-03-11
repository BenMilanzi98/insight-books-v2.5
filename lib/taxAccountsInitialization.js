/**
 * Fixed default GL accounts for tax inflow (collected) and tax outflow (paid).
 * These accounts are system-managed and cannot be changed by tenants.
 * Account codes 2041 and 2045 are always used for tax posting.
 */

import prisma from './prisma';

export const TAX_INFLOW_CODE = '2041';
export const TAX_INFLOW_NAME = 'Tax Inflow (Collected)';
export const TAX_OUTFLOW_CODE = '2045';
export const TAX_OUTFLOW_NAME = 'Tax Outflow (Paid)';
const PARENT_CODE = '2000';

/**
 * Ensure the parent liability account 2000 exists (CURRENT LIABILITIES).
 * @param {string} tenantId
 * @param {object} tx - Prisma client or transaction
 * @returns {Promise<string|null>} parentAccountId
 */
async function ensureParentLiabilityAccount(tenantId, tx = prisma) {
  let parent = await tx.account.findFirst({
    where: { tenantId, accountCode: PARENT_CODE },
    select: { id: true },
  });
  if (parent) return parent.id;
  parent = await tx.account.create({
    data: {
      tenantId,
      accountCode: PARENT_CODE,
      accountName: 'CURRENT LIABILITIES',
      accountType: 'Liability',
      accountSubtype: 'Current Liability',
      normalBalance: 'Credit',
      parentAccountId: null,
      isActive: true,
      isSystem: true,
      balance: 0,
    },
  });
  return parent.id;
}

/**
 * Ensure default tax inflow and outflow accounts exist for the tenant.
 * Creates 2041 (Tax Inflow (Collected)) and 2045 (Tax Outflow (Paid)) if missing.
 * @param {string} tenantId
 * @param {object} tx - Prisma client or transaction
 * @param {boolean} setAsTenantDefaults - If true, set TenantSettings.taxInflowAccountId and taxOutflowAccountId to these accounts when not already set
 * @returns {Promise<{ taxInflowAccountId: string|null, taxOutflowAccountId: string|null }>}
 */
export async function ensureDefaultTaxAccountsForTenant(tenantId, tx = prisma, setAsTenantDefaults = true) {
  const parentId = await ensureParentLiabilityAccount(tenantId, tx);

  let inflow = await tx.account.findFirst({
    where: { tenantId, accountCode: TAX_INFLOW_CODE },
    select: { id: true },
  });
  if (!inflow) {
    inflow = await tx.account.create({
      data: {
        tenantId,
        accountCode: TAX_INFLOW_CODE,
        accountName: TAX_INFLOW_NAME,
        accountType: 'Liability',
        accountSubtype: 'Current Liability',
        normalBalance: 'Credit',
        parentAccountId: parentId,
        description: 'Default account for tax collected from sales, invoices and POS.',
        isActive: true,
        isSystem: true,
        balance: 0,
      },
    });
  }

  let outflow = await tx.account.findFirst({
    where: { tenantId, accountCode: TAX_OUTFLOW_CODE },
    select: { id: true },
  });
  if (!outflow) {
    outflow = await tx.account.create({
      data: {
        tenantId,
        accountCode: TAX_OUTFLOW_CODE,
        accountName: TAX_OUTFLOW_NAME,
        accountType: 'Liability',
        accountSubtype: 'Current Liability',
        normalBalance: 'Credit',
        parentAccountId: parentId,
        description: 'Default account for tax on expenses and supplier bills.',
        isActive: true,
        isSystem: true,
        balance: 0,
      },
    });
  }

  const taxInflowAccountId = inflow?.id ?? null;
  const taxOutflowAccountId = outflow?.id ?? null;

  if (setAsTenantDefaults && (taxInflowAccountId || taxOutflowAccountId)) {
    const settings = await tx.tenantSettings.findUnique({
      where: { tenantId },
      select: { id: true, taxInflowAccountId: true, taxOutflowAccountId: true },
    });
    const updates = {};
    if (taxInflowAccountId && (settings?.taxInflowAccountId == null || settings?.taxInflowAccountId === '')) {
      updates.taxInflowAccountId = taxInflowAccountId;
    }
    if (taxOutflowAccountId && (settings?.taxOutflowAccountId == null || settings?.taxOutflowAccountId === '')) {
      updates.taxOutflowAccountId = taxOutflowAccountId;
    }
    if (Object.keys(updates).length > 0) {
      await tx.tenantSettings.upsert({
        where: { tenantId },
        update: updates,
        create: {
          tenantId,
          ...updates,
        },
      });
    }
  }

  return { taxInflowAccountId, taxOutflowAccountId };
}

/**
 * Get the fixed tax inflow account (2041) for a tenant. Creates it if missing.
 * This account cannot be changed by tenants; it is always used for tax collected from sales/invoices/POS.
 * @param {string} tenantId
 * @param {object} tx - Prisma client or transaction
 * @returns {Promise<{ id: string, accountCode?: string, accountName?: string, accountType?: string }|null>}
 */
export async function getFixedTaxInflowAccount(tenantId, tx = prisma) {
  await ensureDefaultTaxAccountsForTenant(tenantId, tx, true);
  const account = await tx.account.findFirst({
    where: { tenantId, accountCode: TAX_INFLOW_CODE, isActive: true },
    select: { id: true, accountCode: true, accountName: true, accountType: true },
  });
  return account ?? null;
}

/**
 * Get the fixed tax outflow account (2045) for a tenant. Creates it if missing.
 * This account cannot be changed by tenants; it is always used for tax on expenses/supplier bills.
 * @param {string} tenantId
 * @param {object} tx - Prisma client or transaction
 * @returns {Promise<{ id: string, accountCode?: string, accountName?: string, accountType?: string }|null>}
 */
export async function getFixedTaxOutflowAccount(tenantId, tx = prisma) {
  await ensureDefaultTaxAccountsForTenant(tenantId, tx, true);
  const account = await tx.account.findFirst({
    where: { tenantId, accountCode: TAX_OUTFLOW_CODE, isActive: true },
    select: { id: true, accountCode: true, accountName: true, accountType: true },
  });
  return account ?? null;
}
