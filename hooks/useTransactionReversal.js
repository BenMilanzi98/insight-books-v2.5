/**
 * Transaction Reversal Hooks
 * 
 * React hooks for managing transaction reversal functionality
 */

import { useState, useCallback } from 'react';

/**
 * Hook for managing transaction reversal modal state
 * @returns {Object} State and handlers for reversal modal
 */
export function useTransactionReversal() {
  const [isOpen, setIsOpen] = useState(false);
  const [transaction, setTransaction] = useState(null);
  const [transactionType, setTransactionType] = useState('');
  const [step, setStep] = useState('confirm'); // 'confirm', 'reason', 'processing', 'complete'
  const [reversalReason, setReversalReason] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const openModal = useCallback((tx, type) => {
    setTransaction(tx);
    setTransactionType(type);
    setStep('confirm');
    setReversalReason('');
    setPreview(null);
    setError(null);
    setResult(null);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setTransaction(null);
    setTransactionType('');
    setStep('confirm');
    setReversalReason('');
    setPreview(null);
    setError(null);
    setResult(null);
  }, []);

  const goToReasonStep = useCallback(() => {
    setStep('reason');
  }, []);

  const goToConfirmStep = useCallback(() => {
    setStep('confirm');
  }, []);

  const resetState = useCallback(() => {
    setStep('confirm');
    setReversalReason('');
    setPreview(null);
    setError(null);
    setResult(null);
  }, []);

  return {
    isOpen,
    transaction,
    transactionType,
    step,
    reversalReason,
    setReversalReason,
    preview,
    setPreview,
    error,
    setError,
    result,
    setResult,
    openModal,
    closeModal,
    goToReasonStep,
    goToConfirmStep,
    resetState,
    setStep
  };
}

/**
 * Hook for checking reversal eligibility
 * @returns {Object} Eligibility state and checker function
 */
export function useReversalEligibility() {
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const checkEligibility = useCallback(async (transactionId, transactionType) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/transactions/reverse?action=details&transactionId=${transactionId}&transactionType=${transactionType}`
      );

      if (!response.ok) {
        let data = {};
        try {
          data = await response.json();
        } catch (parseError) {
          console.error('Failed to parse eligibility error response:', parseError);
        }
        console.error('Eligibility check failed:', data);
        const message = data?.error || 'Failed to check eligibility';
        throw new Error(message);
      }

      const data = await response.json();
      setEligibility({
        isReversed: data.isReversed,
        original: data.original,
        reversal: data.reversal,
        auditRecords: data.auditRecords,
        isEligible: !data.isReversed && data.original && !data.original.isReversal
      });
    } catch (err) {
      setError(err.message);
      setEligibility(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearEligibility = useCallback(() => {
    setEligibility(null);
    setError(null);
  }, []);

  return {
    eligibility,
    loading,
    error,
    checkEligibility,
    clearEligibility
  };
}

/**
 * Hook for getting reversal impact preview
 * @returns {Object} Impact state and fetcher function
 */
export function useReversalImpact() {
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchImpact = useCallback(async (transactionId, transactionType) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/transactions/reverse?action=impact&transactionId=${transactionId}&transactionType=${transactionType}`
      );

      if (!response.ok) {
        let data = {};
        try {
          data = await response.json();
        } catch (parseError) {
          console.error('Failed to parse impact error response:', parseError);
        }
        console.error('Impact fetch failed:', data);
        const message = data?.error || 'Failed to calculate impact';
        throw new Error(message);
      }

      const data = await response.json();
      setImpact(data);
    } catch (err) {
      setError(err.message);
      setImpact(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearImpact = useCallback(() => {
    setImpact(null);
    setError(null);
  }, []);

  return {
    impact,
    loading,
    error,
    fetchImpact,
    clearImpact
  };
}

/**
 * Hook for executing transaction reversal
 * @returns {Object} Execution state and function
 */
export function useReversalExecution() {
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const executeReversal = useCallback(async (transactionId, transactionType, reversalReason) => {
    setExecuting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/transactions/reverse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transactionId,
          transactionType,
          reversalReason
        })
      });

      if (!response.ok) {
        let data = {};
        try {
          data = await response.json();
        } catch (parseError) {
          console.error('Failed to parse reversal error response:', parseError);
        }
        console.error('Reversal execution failed:', data);
        const message = data?.error || 'Failed to execute reversal';
        throw new Error(message);
      }

      const data = await response.json();
      setResult(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setExecuting(false);
    }
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    executing,
    result,
    error,
    executeReversal,
    clearResult
  };
}

/**
 * Hook for listing reversible transactions
 * @returns {Object} List state and fetcher function
 */
export function useReversibleTransactions() {
  const [transactions, setTransactions] = useState({
    transactions: [],
    invoices: [],
    expenses: [],
    payments: [],
    sales: [],
    supplierPayments: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0
  });

  const fetchTransactions = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: filters.page || pagination.page,
        limit: filters.limit || pagination.limit
      });

      if (filters.transactionType) {
        params.append('transactionType', filters.transactionType);
      }
      if (filters.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params.append('endDate', filters.endDate);
      }

      const response = await fetch(`/api/transactions/reverse?${params}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch transactions');
      }

      const data = await response.json();
      setTransactions({
        transactions: data.transactions || [],
        invoices: data.invoices || [],
        expenses: data.expenses || [],
        payments: data.payments || [],
        sales: data.sales || [],
        supplierPayments: data.supplierPayments || []
      });
      setPagination(prev => ({
        ...prev,
        total: data.total || 0
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit]);

  const clearTransactions = useCallback(() => {
    setTransactions({
      transactions: [],
      invoices: [],
      expenses: [],
      payments: [],
      sales: [],
      supplierPayments: []
    });
    setError(null);
  }, []);

  return {
    transactions,
    loading,
    error,
    pagination,
    fetchTransactions,
    clearTransactions
  };
}
