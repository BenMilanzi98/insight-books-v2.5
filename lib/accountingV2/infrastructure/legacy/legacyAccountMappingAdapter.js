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

/** Legacy code conventions (from the Phase 1 CoA forensic report). */
export const LEGACY_MAPPING_CODES = Object.freeze({
  ACCOUNTS_RECEIVABLE: '1200',
  INVENTORY: '1300',
  ACCOUNTS_PAYABLE: '2110',
  GRNI: '2115',
  VAT_OUTPUT: '2041',
  VAT_INPUT: '1150',
  WITHHOLDING_TAX: '2045',
  PAYE_PAYABLE: '2130',
  SALARIES_EXPENSE: '5200',
  COST_OF_SALES: '5100',
  INVENTORY_LOSS: '5290',
  OWNER_CAPITAL: '3100',
  OPENING_BALANCE_EQUITY: '3190',
  RETAINED_EARNINGS: '3200',
  SALARY_ADVANCE: '1216',
  DEFAULT_REVENUE: '4100',
  POS_REVENUE: '4150',
  CASH_ON_HAND: '1110',
  BANK: '1130',
});

/**
 * Resolve a mapping key to a posting-eligible account for the context business.
 * @param {import('../../domain/accountingContext.js').AccountingContext} context
 * @param {keyof typeof LEGACY_MAPPING_CODES} mappingKey
 * @param {import('@prisma/client').PrismaClient} [db]
 * @returns {Promise<object>} the Account row
 */
export async function resolveLegacyMappedAccount(context, mappingKey, db = prisma) {
  const code = LEGACY_MAPPING_CODES[mappingKey];
  if (!code) {
    throw new MissingAccountMappingError(String(mappingKey), {
      requestId: context.requestId,
      correlationId: context.correlationId,
    });
  }
  const account = await db.account.findFirst({
    where: {
      tenantId: context.businessId,
      OR: [{ accountCode: code }, { code }],
    },
    include: { _count: { select: { childAccounts: { where: { isActive: true } } } } },
  });
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
  if ((account._count?.childAccounts ?? 0) > 0) {
    throw new NonPostingAccountError(
      { mappingKey, accountId: account.id, reason: 'header account with active children' },
      { requestId: context.requestId, correlationId: context.correlationId }
    );
  }
  return account;
}
