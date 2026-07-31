/**
 * Helpers for payment-account balance display and insufficient-funds checks.
 */

export function formatPaymentAccountOptionLabel(account, { currency = 'MWK' } = {}) {
  if (!account) return '';
  const numberLabel = account.reference || account.accountCode || '';
  const name = account.name || 'Account';
  const type = account.accountType ? ` (${account.accountType})` : '';
  const bal = Number(account.balance);
  const balStr = Number.isFinite(bal)
    ? bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';
  const prefix = numberLabel ? `${numberLabel} — ` : '';
  return `${prefix}${name}${type} — Bal: ${currency} ${balStr}`;
}

export function getPaymentAccountBalance(accountOrList, accountId) {
  if (!accountId) return 0;
  if (Array.isArray(accountOrList)) {
    const row = accountOrList.find((a) => a.id === accountId);
    return Number(row?.balance) || 0;
  }
  return Number(accountOrList?.balance) || 0;
}

/**
 * Cash outflow required from the source account for an expense/purchase payment.
 * Pending (AP) payments do not draw from a payment account.
 */
export function getCashOutflowRequired({
  paymentStatus,
  amount,
  paidAmount,
  totalAmount,
} = {}) {
  const status = String(paymentStatus || '').trim();
  if (status === 'Pending') return 0;

  const gross = Number(totalAmount ?? amount) || 0;
  if (status === 'Partially') {
    const paid = Number(paidAmount);
    return Number.isFinite(paid) && paid > 0 ? paid : 0;
  }
  // Fully paid (default)
  return gross > 0 ? gross : 0;
}

/**
 * @returns {{ ok: true } | { ok: false, shortfall: number, available: number, required: number, accountId: string }}
 */
export function checkPaymentAccountFunds({
  paymentAccounts,
  paymentAccountId,
  requiredAmount,
}) {
  const required = Number(requiredAmount) || 0;
  if (!paymentAccountId || required <= 0) {
    return { ok: true };
  }
  const available = getPaymentAccountBalance(paymentAccounts, paymentAccountId);
  if (available + 0.009 >= required) {
    return { ok: true, available, required };
  }
  return {
    ok: false,
    accountId: paymentAccountId,
    available,
    required,
    shortfall: Math.round((required - available) * 100) / 100,
  };
}
