/**
 * Resolve equity CoA accounts by systemPurpose (Phase 3 mapping).
 */

import { AccountingValidationError } from '../../accountingV2/domain/errors.js';

export async function resolveEquityAccountByPurpose(db, tenantId, purpose) {
  const account = await db.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { systemPurpose: purpose },
        { controlAccountPurpose: purpose },
      ],
      acceptsNewTransactions: { not: false },
      postingAllowed: { not: false },
    },
    orderBy: { code: 'asc' },
  });
  if (!account) {
    // Fallback by common codes
    const codeMap = {
      OWNER_CAPITAL: ['3100', '3101'],
      SHARE_CAPITAL: ['3110', '3100'],
      SHARE_PREMIUM: ['3120'],
      OWNER_DRAWINGS: ['3150', '3140'],
      DIVIDENDS_PAYABLE: ['2150', '2100'],
      RETAINED_EARNINGS: ['3200'],
      OPENING_BALANCE_EQUITY: ['3190'],
      OWNER_LOAN_LIABILITY: ['2200', '2500'],
    };
    const codes = codeMap[purpose] || [];
    if (codes.length) {
      const byCode = await db.account.findFirst({
        where: {
          tenantId,
          isActive: true,
          OR: codes.flatMap((c) => [{ code: c }, { accountCode: c }]),
        },
      });
      if (byCode) return byCode;
    }
    throw new AccountingValidationError(`Missing equity account mapping for purpose ${purpose}.`, [
      { path: 'purpose', message: purpose },
    ]);
  }
  if (String(account.coaV2Behaviour || '').toUpperCase() === 'HEADER') {
    throw new AccountingValidationError('Mapped equity account must be a posting account.', [
      { path: 'accountId', message: account.id },
    ]);
  }
  return account;
}

export async function resolveBankOrCashAccount(db, tenantId, accountId) {
  const account = await db.account.findFirst({
    where: { id: accountId, tenantId, isActive: true },
  });
  if (!account) {
    throw new AccountingValidationError('Bank/cash account not found for this business.', [
      { path: 'bankAccountId', message: 'not found' },
    ]);
  }
  return account;
}
