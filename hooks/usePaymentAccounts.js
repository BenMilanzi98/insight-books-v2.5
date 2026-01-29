import { useState, useEffect } from 'react';

/**
 * Custom hook to fetch payment accounts from the API
 * Returns payment accounts, loading state, and error state
 */
export function usePaymentAccounts() {
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPaymentAccounts = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/payment-accounts');
        if (!response.ok) {
          throw new Error('Failed to fetch payment accounts');
        }
        
        const data = await response.json();
        
        // Filter to only active accounts
        const activeAccounts = (data.paymentAccounts || []).filter(acc => acc.isActive);
        setPaymentAccounts(activeAccounts);
      } catch (err) {
        console.error('Error fetching payment accounts:', err);
        setError(err.message);
        setPaymentAccounts([]); // Set empty array on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaymentAccounts();
  }, []);

  return { paymentAccounts, isLoading, error };
}

