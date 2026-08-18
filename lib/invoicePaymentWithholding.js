import { addMoney, parseMoney, roundMoney } from './money.js';

/**
 * Compute WHT split when the user enters cash received and an optional withholding %.
 * gross AR cleared = cash + WHT (customer withheld tax on the payment).
 */
export function computeInvoicePaymentWithholding(cashReceived, withholdingPercent) {
  const cash = parseMoney(cashReceived);
  const pct = Number(withholdingPercent) || 0;
  if (pct <= 0) {
    return {
      cashReceived: cash,
      withholdingAmount: 0,
      grossAppliedToAr: cash,
      withholdingPercent: 0,
    };
  }
  if (pct >= 100) {
    const err = new Error('Withholding percent must be less than 100');
    err.statusCode = 400;
    throw err;
  }
  const withholdingAmount = roundMoney((cash * pct) / (100 - pct));
  const grossAppliedToAr = addMoney(cash, withholdingAmount);
  return {
    cashReceived: cash,
    withholdingAmount,
    grossAppliedToAr,
    withholdingPercent: pct,
  };
}

/** Resolve WHT receivable GL (2041-03 or catalog fallback). */
export async function resolveWhtReceivableAccount(db, tenantId) {
  const byCode = await db.account.findFirst({
    where: { tenantId, isActive: true, accountCode: '2041-03' },
  });
  if (byCode) return byCode;

  const taxType = await db.taxType.findFirst({
    where: {
      tenantId,
      OR: [
        { taxId: 'MW-WHT' },
        { taxCode: 'MW-WHT' },
        { taxName: { contains: 'Withholding', mode: 'insensitive' } },
      ],
    },
    include: { account: true },
  });
  if (taxType?.account?.id) return taxType.account;

  try {
    const { resolvePurposeAccount } = await import('./coaV2/application/accountMappingRegistry.js');
    return await resolvePurposeAccount({ tenantId, businessId: tenantId }, 'WITHHOLDING_TAX_PAYABLE', {}, db);
  } catch {
    return null;
  }
}
