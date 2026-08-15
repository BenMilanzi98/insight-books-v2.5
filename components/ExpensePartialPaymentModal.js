import { tt } from '@/lib/i18n/runtime';
import React, { useState, useEffect } from 'react';
import { X, CreditCard, DollarSign, Calendar, FileText, AlertCircle, Loader } from 'lucide-react';
import { usePaymentAccounts } from '@/hooks/usePaymentAccounts';
import AddTransferFundsPanel from '@/components/payments/AddTransferFundsPanel';
import { parseMoney, subtractMoney } from '@/lib/money';
import {
  checkPaymentAccountFunds,
  formatPaymentAccountOptionLabel,
} from '@/lib/paymentAccountFunds';

const ExpensePartialPaymentModal = ({ 
  isOpen, 
  onClose, 
  expense, 
  onPaymentSuccess 
}) => {
  const [formData, setFormData] = useState({
    amount: '',
    paymentMethod: 'cash',
    paymentDate: new Date().toISOString().split('T')[0],
    reference: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [remainingBalance, setRemainingBalance] = useState(0);
  const [fundsCheck, setFundsCheck] = useState(null);
  const [showFundPanel, setShowFundPanel] = useState(false);

  // Load payment accounts dynamically
  const {
    paymentAccounts,
    isLoading: isLoadingPaymentAccounts,
    refresh: refreshPaymentAccounts,
  } = usePaymentAccounts();

  // Reset form when modal opens/closes or expense changes
  useEffect(() => {
    if (isOpen && expense && paymentAccounts.length > 0) {
      console.log('ExpensePartialPaymentModal - expense data:', expense);
      
      // Parse amounts more robustly
      const parseAmount = parseMoney;
      
      // Calculate remaining balance based on payment status
      let remaining = 0;
      const expenseAmount = parseAmount(expense.amount);
      
      console.log('Parsed amounts:', {
        originalAmount: expense.amount,
        parsedAmount: expenseAmount,
        originalPaidAmount: expense.paidAmount,
        parsedPaidAmount: parseAmount(expense.paidAmount)
      });
      
      if (expense.paymentStatus === 'Pending') {
        remaining = expenseAmount;
      } else if (expense.paymentStatus === 'Partially') {
        const paidAmount = parseAmount(expense.paidAmount);
        remaining = subtractMoney(expenseAmount, paidAmount);
      }
      // If fully paid, remaining should be 0
      
      setRemainingBalance(remaining);
      // Set default payment method to first available account (prefer Cash)
      const defaultAccount = paymentAccounts.find(acc => acc.accountType === 'Cash' && acc.isActive) || paymentAccounts[0];
      setFormData({
        amount: '',
        paymentMethod: defaultAccount?.id || '',
        paymentDate: new Date().toISOString().split('T')[0],
        reference: '',
        notes: ''
      });
      setError('');
    }
  }, [isOpen, expense, paymentAccounts]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      amount: value
    }));
    
    // Live validation
    const amount = parseFloat(value) || 0;
    if (value && value.trim() !== '') {
      if (amount > remainingBalance) {
        setError(`Amount cannot exceed remaining balance of ${formatCurrency(remainingBalance)}`);
      } else if (amount <= 0) {
        setError('Amount must be greater than 0');
      } else {
        setError('');
      }
    } else {
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    if (parseFloat(formData.amount) > remainingBalance) {
      setError(`Amount cannot exceed remaining balance of ${remainingBalance.toFixed(2)}`);
      return;
    }

    const check = checkPaymentAccountFunds({
      paymentAccounts,
      paymentAccountId: formData.paymentMethod,
      requiredAmount: parseFloat(formData.amount),
    });
    if (!check.ok) {
      setFundsCheck(check);
      setShowFundPanel(true);
      setError(
        `Insufficient funds in payment account. Available MWK ${Number(check.available).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, required MWK ${Number(check.required).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
      );
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/expenses/partial-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expenseId: expense.id,
          ...formData
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process payment');
      }

      // Success - close modal and refresh data
      onPaymentSuccess(data);
      onClose();
      
    } catch (error) {
      console.error('Error processing payment:', error);
      setError(error.message || 'Failed to process payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    // Handle null/undefined
    if (amount === null || amount === undefined) {
      console.warn('Null/undefined amount for formatting:', amount);
      return 'MWK 0.00';
    }
    
    // Ensure amount is a number
    let numericAmount;
    if (typeof amount === 'string') {
      // Remove commas and parse
      const cleaned = amount.replace(/,/g, '').trim();
      numericAmount = parseFloat(cleaned);
    } else if (typeof amount === 'number') {
      numericAmount = amount;
    } else {
      console.warn('Unexpected amount type for formatting:', typeof amount, amount);
      return 'MWK 0.00';
    }
    
    // Handle NaN or invalid amounts
    if (isNaN(numericAmount)) {
      console.warn('Invalid amount for formatting:', amount, 'parsed as:', numericAmount);
      return 'MWK 0.00';
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MWK'
    }).format(numericAmount);
  };

  if (!isOpen || !expense) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <CreditCard className="h-5 w-5 mr-2 text-green-600" />
            {tt('Add Payment')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {/* Expense Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">{tt('Expense Details')}</h3>
            <div className="space-y-1 text-sm text-gray-600">
              <div><span className="font-medium">{tt('Description:')}</span> {expense.description}</div>
              <div><span className="font-medium">{tt('Amount:')}</span> {formatCurrency(expense.amount)}</div>
              <div><span className="font-medium">{tt('Current Status:')}</span> 
                <span className={`ml-1 px-2 py-1 rounded-full text-xs font-medium ${
                  expense.paymentStatus === 'Fully paid' ? 'bg-green-100 text-green-800' :
                  expense.paymentStatus === 'Partially' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {expense.paymentStatus}
                </span>
              </div>
              {expense.paymentStatus === 'Partially' && (
                <div><span className="font-medium">{tt('Paid:')}</span> {formatCurrency(expense.paidAmount || 0)}</div>
              )}
              <div><span className="font-medium">{tt('Remaining:')}</span> 
                <span className="ml-1 font-semibold text-red-600">
                  {formatCurrency(remainingBalance)}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Payment Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <DollarSign className="h-4 w-4 inline mr-1" />
                {tt('Payment Amount *')}
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleAmountChange}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder={tt('Enter payment amount')}
                step="0.01"
                min="0.01"
                max={remainingBalance}
                required
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum: {formatCurrency(remainingBalance)}
              </p>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <CreditCard className="h-4 w-4 inline mr-1" />
                {tt('Payment Method *')}
              </label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
                disabled={isSubmitting || isLoadingPaymentAccounts}
              >
                <option value="">{isLoadingPaymentAccounts ? 'Loading accounts...' : 'Select an account'}</option>
                {paymentAccounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {formatPaymentAccountOptionLabel(account)}
                  </option>
                ))}
              </select>
              {showFundPanel && fundsCheck && !fundsCheck.ok && (
                <AddTransferFundsPanel
                  destinationAccountId={formData.paymentMethod}
                  destinationAccountName={
                    paymentAccounts.find((a) => a.id === formData.paymentMethod)?.name || ''
                  }
                  shortfall={fundsCheck.shortfall}
                  requiredAmount={fundsCheck.required}
                  availableAmount={fundsCheck.available}
                  paymentAccounts={paymentAccounts}
                  onCancel={() => setShowFundPanel(false)}
                  onSuccess={async () => {
                    setShowFundPanel(false);
                    setFundsCheck(null);
                    setError('');
                    await refreshPaymentAccounts();
                  }}
                />
              )}
            </div>

            {/* Payment Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="h-4 w-4 inline mr-1" />
                {tt('Payment Date *')}
              </label>
              <input
                type="date"
                name="paymentDate"
                value={formData.paymentDate}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Payment Reference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FileText className="h-4 w-4 inline mr-1" />
                {tt('Payment Reference')}
              </label>
              <input
                type="text"
                name="reference"
                value={formData.reference}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder={tt('Check number, transaction ID, etc.')}
                disabled={isSubmitting}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tt('Notes')}
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder={tt('Additional notes about this payment')}
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                disabled={isSubmitting}
              >
                {tt('Cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting || !!error}
              >
                {isSubmitting ? 'Processing...' : 'Add Payment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ExpensePartialPaymentModal;
