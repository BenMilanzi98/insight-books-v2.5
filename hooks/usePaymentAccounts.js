import { useState, useEffect } from 'react';

/**
 * Same source as /payments/management: balances first, then active accounts list.
 * Returns rows suitable for selects (id, name, accountType, balance, …).
 */
async function fetchPaymentAccountsLikeManagement() {
  const balanceRes = await fetch('/api/payment-accounts/balances', { cache: 'no-store' });
  const balanceData = await balanceRes.json().catch(() => ({}));
  if (balanceRes.ok && balanceData.success && Array.isArray(balanceData.accounts)) {
    return balanceData.accounts.filter((a) => a.isActive !== false);
  }

  const listRes = await fetch('/api/payment-accounts?activeOnly=true', { cache: 'no-store' });
  const listData = await listRes.json().catch(() => ({}));
  if (!listRes.ok) {
    const msg = listData?.hint || listData?.error || 'Failed to fetch payment accounts';
    throw new Error(msg);
  }
  const raw = listData.paymentAccounts || [];
  return raw
    .filter((a) => a.isActive !== false)
    .map((a) => ({
      id: a.id,
      name: a.name,
      accountType: a.accountType,
      reference: a.reference,
      isSystem: a.isSystem,
      isActive: a.isActive,
      balance: typeof a.balance === 'number' ? a.balance : 0,
    }));
}

/**
 * @returns {{ paymentAccounts: Array, isLoading: boolean, error: string|null }}
 */
export function usePaymentAccounts() {
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const accounts = await fetchPaymentAccountsLikeManagement();
        setPaymentAccounts(accounts);
      } catch (err) {
        console.error('Error fetching payment accounts:', err);
        setError(err.message);
        setPaymentAccounts([]);
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, []);

  return { paymentAccounts, isLoading, error };
}
