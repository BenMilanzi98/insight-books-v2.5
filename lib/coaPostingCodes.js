/**
 * Canonical GL codes for postings (aligned with chartOfAccountsBlueprint).
 * Resolvers prefer new codes and fall back to legacy rows until migrations complete.
 */

import prisma from './prisma.js';
import { accountBlocksDirectPosting } from './coaDirectPostingEligibility.js';

export const CODE_CASH_MAIN = '1110';
export const CODE_CASH_CUSTOM_GROUP = '1120';
export const CODE_ACCOUNTS_RECEIVABLE = '1200';

/**
 * AR invoice sub-ledger overlay applies only to canonical 1200 — not 1220 (VAT receivable) or 1230 (other receivables).
 * @param {{ accountCode?: string, code?: string, accountType?: string, type?: string }} account
 * @param {{ hasChildren?: boolean }} [opts]
 */
export function isAccountsReceivableSubledgerLeaf(account, { hasChildren = false } = {}) {
  if (hasChildren) return false;
  const accountCode = String(account?.accountCode || account?.code || '').trim();
  const accountType = String(account?.accountType || account?.type || '').trim().toUpperCase();
  return (
    (accountType === 'ASSET' || accountType === 'Asset') &&
    accountCode === CODE_ACCOUNTS_RECEIVABLE
  );
}
export const CODE_ACCOUNTS_PAYABLE = '2110';
/** Goods Received Not Invoiced (accrued purchases clearing). */
export const CODE_GRNI = '2115';
export const CODE_CURRENT_LIABILITIES_GROUP = '2100';
export const CODE_PRODUCT_SALES = '4100';
export const CODE_SERVICE_REVENUE = '4150';
export const CODE_SERVICE_REVENUE_LEGACY = '4200';
export const CODE_COST_OF_SALES = '5100';
export const CODE_REVENUE_ROOT = '4000';

/** Five top-level chart sections — must not receive direct postings (rollup / header only). */
export const COA_STRUCTURAL_ROOT_CODES = ['1000', '2000', '3000', '4000', '5000'];

/** @param {string|null|undefined} code */
export function isCoaStructuralRootCode(code) {
  const c = String(code ?? '').trim();
  return COA_STRUCTURAL_ROOT_CODES.includes(c);
}

/**
 * Current Liabilities (2100) posting group — not trade payables.
 * @param {string} tenantId
 * @param {object} tx
 * @returns {Promise<string|null>}
 */
export async function findCurrentLiabilitiesGroupId(tenantId, tx = prisma) {
  const row = await tx.account.findFirst({
    where: {
      tenantId,
      accountCode: CODE_CURRENT_LIABILITIES_GROUP,
      accountType: 'Liability',
      isActive: true,
      OR: [
        { accountSubtype: 'Group' },
        { accountName: { contains: 'Current Liabilities', mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });
  return row?.id ?? null;
}

/**
 * Trade Accounts Payable GL (2110), with legacy 2100 AP fallback.
 * Never returns the 2100 "Current Liabilities" group row.
 * @param {string} tenantId
 * @param {object} tx
 */
export async function findAccountsPayableGlAccount(tenantId, tx = prisma) {
  const ap2110 = await tx.account.findFirst({
    where: {
      tenantId,
      accountCode: CODE_ACCOUNTS_PAYABLE,
      accountType: 'Liability',
      isActive: true,
    },
  });
  if (ap2110) return ap2110;

  const legacy2100 = await tx.account.findFirst({
    where: {
      tenantId,
      accountCode: CODE_CURRENT_LIABILITIES_GROUP,
      accountType: 'Liability',
      isActive: true,
      NOT: {
        OR: [
          { accountSubtype: 'Group' },
          { accountName: { contains: 'Current Liabilities', mode: 'insensitive' } },
        ],
      },
    },
  });
  if (legacy2100 && /payable|supplier|trade/i.test(legacy2100.accountName || '')) {
    return legacy2100;
  }

  return tx.account.findFirst({
    where: {
      tenantId,
      accountName: { contains: 'Accounts Payable', mode: 'insensitive' },
      accountType: 'Liability',
      isActive: true,
    },
  });
}

/**
 * GRNI / accrued purchases clearing (2115).
 * @param {string} tenantId
 * @param {object} tx
 */
export async function findGrniGlAccount(tenantId, tx = prisma) {
  return tx.account.findFirst({
    where: {
      tenantId,
      accountCode: CODE_GRNI,
      accountType: 'Liability',
      isActive: true,
    },
  });
}

/**
 * Postable trade receivables account (1200 leaf). Falls back to an active receivable detail under 1100.
 * @param {string} tenantId
 * @param {object} tx
 */
export async function findAccountsReceivableGlAccount(tenantId, tx = prisma) {
  const withChildren = {
    include: {
      _count: { select: { childAccounts: { where: { isActive: true } } } },
    },
  };

  const primary = await tx.account.findFirst({
    where: {
      tenantId,
      accountCode: CODE_ACCOUNTS_RECEIVABLE,
      accountType: 'Asset',
      isActive: true,
    },
    ...withChildren,
  });
  if (primary && !accountBlocksDirectPosting(primary).blocked) return primary;

  if (primary?.id) {
    const child = await tx.account.findFirst({
      where: {
        tenantId,
        parentAccountId: primary.id,
        accountType: 'Asset',
        isActive: true,
      },
      orderBy: { accountCode: 'asc' },
      ...withChildren,
    });
    if (child && !accountBlocksDirectPosting(child).blocked) return child;
  }

  const candidates = await tx.account.findMany({
    where: {
      tenantId,
      accountType: 'Asset',
      isActive: true,
      accountName: { contains: 'Receivable', mode: 'insensitive' },
      NOT: [
        { accountName: { contains: 'VAT', mode: 'insensitive' } },
        { accountName: { contains: 'Insurance', mode: 'insensitive' } },
        { accountName: { contains: 'Salary Advance', mode: 'insensitive' } },
      ],
    },
    orderBy: { accountCode: 'asc' },
    ...withChildren,
    take: 20,
  });
  for (const c of candidates) {
    if (!accountBlocksDirectPosting(c).blocked) return c;
  }

  return null;
}

/**
 * Default revenue account for invoice line items (4100 Product Sales).
 * @param {string} tenantId
 * @param {object} tx
 */
export async function findDefaultInvoiceRevenueAccount(tenantId, tx = prisma) {
  return tx.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      accountCode: CODE_PRODUCT_SALES,
      accountType: { in: ['Income', 'Revenue'] },
    },
  });
}

/**
 * Liabilities root (2000) for attaching the current-liabilities group when missing.
 * @param {string} tenantId
 * @param {object} tx
 */
export async function findLiabilitiesRootId(tenantId, tx = prisma) {
  const root = await tx.account.findFirst({
    where: { tenantId, accountCode: '2000', accountType: 'Liability', isActive: true },
    select: { id: true },
  });
  return root?.id ?? null;
}
