/**
 * Bank reconciliation configuration — PaymentAccount + posting CoA validation.
 */

import { RECONCILABLE_PAYMENT_TYPES } from '../domain/enums.js';
import { AccountingValidationError } from '../../accountingV2/domain/errors.js';

const POSTABLE = new Set([true, 'true', 1]);

export async function getPaymentAccountForRecon(db, tenantId, paymentAccountId) {
  const pa = await db.paymentAccount.findFirst({
    where: { id: paymentAccountId, tenantId },
    include: { coaAccount: true },
  });
  if (!pa) {
    throw new AccountingValidationError('Payment account not found for this business.', [
      { path: 'paymentAccountId', message: 'not found' },
    ]);
  }
  return pa;
}

export function assertReconcilablePaymentAccount(pa) {
  if (!pa.isActive) {
    throw new AccountingValidationError('Payment account is inactive.', [
      { path: 'paymentAccountId', message: 'inactive' },
    ]);
  }
  if (!RECONCILABLE_PAYMENT_TYPES.includes(pa.accountType)) {
    throw new AccountingValidationError(
      `Only Bank and Mobile Money accounts are reconcilable (got ${pa.accountType}).`,
      [{ path: 'accountType', message: 'not reconcilable' }]
    );
  }
  if (!pa.coaAccountId || !pa.coaAccount) {
    throw new AccountingValidationError('Payment account must be linked to a Chart of Accounts cash/bank account.', [
      { path: 'coaAccountId', message: 'required' },
    ]);
  }
  const coa = pa.coaAccount;
  if (coa.tenantId && coa.tenantId !== pa.tenantId) {
    throw new AccountingValidationError('CoA account belongs to a different business.', [
      { path: 'coaAccountId', message: 'cross-tenant' },
    ]);
  }
  // Header / non-posting accounts must not be recon targets
  if (coa.postingAllowed === false || coa.acceptsNewTransactions === false) {
    throw new AccountingValidationError('Linked CoA account must be a posting cash/bank account (not a header).', [
      { path: 'coaAccountId', message: 'not posting' },
    ]);
  }
  if (String(coa.coaV2Behaviour || '').toUpperCase() === 'HEADER') {
    throw new AccountingValidationError('Linked CoA account must not be a header account.', [
      { path: 'coaAccountId', message: 'header' },
    ]);
  }
  return true;
}

export async function upsertConfiguration(db, context, input) {
  const pa = await getPaymentAccountForRecon(db, context.businessId, input.paymentAccountId);
  assertReconcilablePaymentAccount(pa);

  const data = {
    tenantId: context.businessId,
    paymentAccountId: pa.id,
    coaAccountId: pa.coaAccountId,
    enabled: input.enabled ?? true,
    currency: input.currency || 'MWK',
    dateToleranceDays: input.dateToleranceDays ?? 3,
    amountToleranceMinor: input.amountToleranceMinor ?? 0,
    autoMatchMinConfidence: input.autoMatchMinConfidence || 'HIGH',
    requireSeparateApprover: input.requireSeparateApprover ?? true,
    staleOutstandingDays: input.staleOutstandingDays ?? 30,
    defaultProfileId: input.defaultProfileId ?? null,
    metadata: input.metadata ?? undefined,
    updatedBy: context.userId ?? null,
  };

  const existing = await db.bankRecConfiguration.findUnique({
    where: { paymentAccountId: pa.id },
  });
  if (existing) {
    if (existing.tenantId !== context.businessId) {
      throw new AccountingValidationError('Cross-tenant configuration access blocked.', [
        { path: 'tenantId', message: 'mismatch' },
      ]);
    }
    return db.bankRecConfiguration.update({
      where: { paymentAccountId: pa.id },
      data,
    });
  }
  return db.bankRecConfiguration.create({
    data: { ...data, createdBy: context.userId ?? null },
  });
}

export async function getConfiguration(db, tenantId, paymentAccountId) {
  return db.bankRecConfiguration.findFirst({
    where: { tenantId, paymentAccountId },
  });
}

export async function listReconcilableAccounts(db, tenantId) {
  const accounts = await db.paymentAccount.findMany({
    where: {
      tenantId,
      isActive: true,
      accountType: { in: [...RECONCILABLE_PAYMENT_TYPES] },
      coaAccountId: { not: null },
    },
    include: {
      coaAccount: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          accountType: true,
          coaV2Category: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });
  const configs = await db.bankRecConfiguration.findMany({
    where: { tenantId, paymentAccountId: { in: accounts.map((a) => a.id) } },
  });
  const byPa = new Map(configs.map((c) => [c.paymentAccountId, c]));
  return accounts.map((a) => ({
    ...a,
    configuration: byPa.get(a.id) || null,
  }));
}

export { POSTABLE };
