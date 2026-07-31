import { parseMoney, subtractMoney, addMoney } from '@/lib/money';

/**
 * Build deposit receipt lines: Dr Cash/Bank, Cr Deposit Liability.
 */
export function buildDepositReceiptLines({ cashAccountId, depositLiabilityAccountId, amount }) {
  const amt = parseMoney(amount);
  if (amt <= 0) throw new Error('Deposit amount must be positive');
  if (!cashAccountId || !depositLiabilityAccountId) {
    throw new Error('cashAccountId and depositLiabilityAccountId required');
  }
  return [
    { accountId: cashAccountId, debit: amt, credit: 0, description: 'Customer rental deposit' },
    {
      accountId: depositLiabilityAccountId,
      debit: 0,
      credit: amt,
      description: 'Customer rental deposits liability',
    },
  ];
}

export function buildDepositRefundLines({ cashAccountId, depositLiabilityAccountId, amount }) {
  const amt = parseMoney(amount);
  return [
    {
      accountId: depositLiabilityAccountId,
      debit: amt,
      credit: 0,
      description: 'Refund customer rental deposit',
    },
    { accountId: cashAccountId, debit: 0, credit: amt, description: 'Deposit refund' },
  ];
}

export function buildDepositApplyLines({ depositLiabilityAccountId, arAccountId, amount }) {
  const amt = parseMoney(amount);
  return [
    {
      accountId: depositLiabilityAccountId,
      debit: amt,
      credit: 0,
      description: 'Apply deposit to receivable',
    },
    { accountId: arAccountId, debit: 0, credit: amt, description: 'Clear AR via deposit' },
  ];
}

export function remainingDeposit(deposit) {
  return Math.max(
    0,
    parseMoney(
      subtractMoney(
        parseMoney(deposit.receivedAmount),
        addMoney(
          parseMoney(deposit.appliedAmount),
          parseMoney(deposit.refundedAmount),
          parseMoney(deposit.forfeitedAmount)
        )
      )
    )
  );
}

export function assertDepositNotOverApplied(deposit, applyAmount) {
  const rem = remainingDeposit(deposit);
  if (parseMoney(applyAmount) > rem + 0.001) {
    throw new Error(`Cannot apply ${applyAmount}; remaining deposit ${rem}`);
  }
}
