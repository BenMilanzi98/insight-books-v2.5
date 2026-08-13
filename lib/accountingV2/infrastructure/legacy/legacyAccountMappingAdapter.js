/**
 * Accounting V2 — legacy account mapping adapter.
 *
 * READS: `Account` rows by the legacy hardcoded code conventions.
 * WRITES: nothing. Never auto-creates accounts (unlike several legacy resolvers).
 *
 * V2 policy difference: a missing mapping raises `MissingAccountMappingError` —
 * there is NO fallback to name matching, first-in-category, parents, or accounts
 * from other businesses.
 *
 * Known inherited defects (documented): the code table below reflects the legacy
 * hardcoded conventions catalogued in CHART_OF_ACCOUNTS_FORENSIC_REPORT.md; codes
 * may be duplicated or repurposed in pre-blueprint tenants. Phase 3 replaces this
 * with a configured, versioned mapping registry.
 */

import prisma from '../../../prisma.js';
import { MissingAccountMappingError, NonPostingAccountError, InactiveAccountError } from '../../domain/errors.js';

/**
 * Legacy code conventions aligned to posting-level leaves (see systemPurposes.js).
 * Header/group codes (1300 Inventory, 5100 Cost of Sales, 2041 Tax Inflow) must not
 * be used — V2 rejects accounts with active children / acceptsNewTransactions=false.
 */
export const LEGACY_MAPPING_CODES = Object.freeze({
  ACCOUNTS_RECEIVABLE: '1200',
  INVENTORY: '1310', // Stock on Hand (1300 is header)
  ACCOUNTS_PAYABLE: '2110',
  GRNI: '2115',
  VAT_OUTPUT: '2120', // VAT Payable leaf (2041 is tax-inflow header)
  DEFERRED_REVENUE: '2150',
  VAT_INPUT: '1240', // VAT Recoverable (legacy 1150 often absent)
  WITHHOLDING_TAX: '2045-01', // leaf under 2045 when present; adapter falls back
  PAYE_PAYABLE: '2130',
  SALARIES_EXPENSE: '5200',
  COST_OF_SALES: '5110', // Purchases / COGS leaf (5100 is header)
  INVENTORY_LOSS: '5290',
  OWNER_CAPITAL: '3100',
  OPENING_BALANCE_EQUITY: '3190',
  RETAINED_EARNINGS: '3200',
  SALARY_ADVANCE: '1216',
  DEFAULT_REVENUE: '4100',
  POS_REVENUE: '4150',
  CASH_ON_HAND: '1110',
  BANK: '1130',
  OTHER_INCOME: '4900',
});

/** When a primary code is a rollup, try these posting leaves in order. */
const HEADER_LEAF_FALLBACKS = Object.freeze({
  '1300': ['1310', '1320', '1330'],
  '5100': ['5110', '5120'],
  '2041': ['2120', '2041-01'],
  '2045': ['2045-01'],
  '1150': ['1240', '2045-01'],
});

/**
 * Resolve a mapping key to a posting-eligible account for the context business.
 * @param {import('../../domain/accountingContext.js').AccountingContext} context
 * @param {keyof typeof LEGACY_MAPPING_CODES} mappingKey
 * @param {import('@prisma/client').PrismaClient} [db]
 * @returns {Promise<object>} the Account row
 */
function isPostingEligible(account) {
  if (!account || account.isActive === false) return false;
  if (account.acceptsNewTransactions === false) return false;
  if ((account._count?.childAccounts ?? 0) > 0) return false;
  return true;
}

async function findAccountByCode(db, tenantId, code) {
  return db.account.findFirst({
    where: {
      tenantId,
      OR: [{ accountCode: code }, { code }],
    },
    include: { _count: { select: { childAccounts: { where: { isActive: true } } } } },
  });
}

/**
 * Resolve a posting leaf when the mapped code is a rollup/header.
 */
async function resolvePostingLeaf(db, context, account, mappingKey) {
  if (isPostingEligible(account)) return account;

  const primaryCode = account?.accountCode || account?.code || '';
  const fallbacks = HEADER_LEAF_FALLBACKS[primaryCode] || [];
  for (const leafCode of fallbacks) {
    const leaf = await findAccountByCode(db, context.businessId, leafCode);
    if (isPostingEligible(leaf)) return leaf;
  }

  if (account?.id) {
    const child = await db.account.findFirst({
      where: {
        tenantId: context.businessId,
        parentAccountId: account.id,
        isActive: true,
        acceptsNewTransactions: true,
      },
      include: { _count: { select: { childAccounts: { where: { isActive: true } } } } },
      orderBy: [{ accountCode: 'asc' }, { code: 'asc' }],
    });
    if (isPostingEligible(child)) return child;
  }

  throw new NonPostingAccountError(
    {
      mappingKey,
      accountId: account?.id,
      reason: 'header/retired account with no posting leaf',
      code: primaryCode,
    },
    { requestId: context.requestId, correlationId: context.correlationId }
  );
}

export async function resolveLegacyMappedAccount(context, mappingKey, db = prisma) {
  const code = LEGACY_MAPPING_CODES[mappingKey];
  if (!code) {
    throw new MissingAccountMappingError(String(mappingKey), {
      requestId: context.requestId,
      correlationId: context.correlationId,
    });
  }

  let account = await findAccountByCode(db, context.businessId, code);

  // Older tenants may still only have header codes — try known leaf fallbacks.
  if (!account) {
    const fallbacks = HEADER_LEAF_FALLBACKS[code] || [];
    for (const leafCode of fallbacks) {
      account = await findAccountByCode(db, context.businessId, leafCode);
      if (account) break;
    }
  }

  if (!account) {
    throw new MissingAccountMappingError(`${mappingKey} (code ${code})`, {
      requestId: context.requestId,
      correlationId: context.correlationId,
    });
  }
  if (account.isActive === false) {
    throw new InactiveAccountError(
      { mappingKey, accountId: account.id },
      { requestId: context.requestId, correlationId: context.correlationId }
    );
  }

  return resolvePostingLeaf(db, context, account, mappingKey);
}
