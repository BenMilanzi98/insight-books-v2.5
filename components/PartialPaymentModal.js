import { tt } from '@/lib/i18n/runtime';
import React, { useState, useEffect } from 'react';
import { X, CreditCard, DollarSign, Calendar, FileText, AlertCircle, Loader } from 'lucide-react';
import { usePaymentAccounts } from '@/hooks/usePaymentAccounts';

const PartialPaymentModal = ({ 
  isOpen, 
  onClose, 
  invoice, 
  onPaymentSuccess 
}) => {
  const [formData, setFormData] = useState({
    amount: '',
    paymentMethod: '',
    paymentDate: new Date().toISOString().split('T')[0],
    reference: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [remainingBalance, setRemainingBalance] = useState(0);

  // Load payment accounts dynamically
  const { paymentAccounts, isLoading: isLoadingPaymentAccounts } = usePaymentAccounts();

  // Reset form when modal opens/closes or invoice changes
  useEffect(() => {
    if (isOpen && invoice) {
      const remaining = invoice.total - (invoice.totalPaid || 0);
      setRemainingBalance(remaining);
      // Management-configured accounts only (same as /payments/management).
      const defaultAccount =
        paymentAccounts.find((acc) => acc.accountType === 'Cash' && acc.isActive) ||
        paymentAccounts[0];
      setFormData({
        amount: '',
        paymentMethod: defaultAccount?.id || '',
        paymentDate: new Date().toISOString().split('T')[0],
        reference: '',
        notes: ''
      });
      setError('');
    }
  }, [isOpen, invoice, paymentAccounts]);

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
    
    // Validate amount
    const amount = parseFloat(value) || 0;
    if (amount > remainingBalance) {
      setError(`Amount cannot exceed remaining balance of ${remainingBalance.toFixed(2)}`);
    } else if (amount <= 0) {
      setError('Amount must be greater than 0');
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

    if (!formData.paymentMethod) {
      setError('Please select a payment account');
      return;
    }

    if (parseFloat(formData.amount) > remainingBalance) {
      setError(`Amount cannot exceed remaining balance of ${remainingBalance.toFixed(2)}`);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/invoices/partial-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoice.id,
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
      console.error('Error processing partial payment:', error);
      setError(error.message || 'Failed to process payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MWK'
    }).format(amount);
  };

  if (!isOpen || !invoice) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CreditCard className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{tt('Record Payment')}</h2>
              <p className="text-sm text-gray-600">Invoice #{invoice.invoiceNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Invoice Summary */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">{tt('Total Amount:')}</span>
              <p className="font-semibold text-gray-900">{formatCurrency(invoice.total)}</p>
            </div>
            <div>
              <span className="text-gray-600">{tt('Amount Paid:')}</span>
              <p className="font-semibold text-green-600">{formatCurrency(invoice.totalPaid || 0)}</p>
            </div>
            <div>
              <span className="text-gray-600">{tt('Remaining Balance:')}</span>
              <p className="font-semibold text-red-600">{formatCurrency(remainingBalance)}</p>
            </div>
            <div>
              <span className="text-gray-600">{tt('Status:')}</span>
              <p className="font-semibold capitalize">{invoice.status}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}

          {/* Payment Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {tt('Payment Amount *')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleAmountChange}
                step="0.01"
                min="0.01"
                max={remainingBalance}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Maximum: {formatCurrency(remainingBalance)}
            </p>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {tt('Payment Method *')}
            </label>
            <select
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isLoadingPaymentAccounts}
            >
              <option value="">{isLoadingPaymentAccounts ? 'Loading accounts...' : 'Select an account'}</option>
              {paymentAccounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name} {account.accountType ? `(${account.accountType})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {tt('Payment Date *')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="date"
                name="paymentDate"
                value={formData.paymentDate}
                onChange={handleInputChange}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Reference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reference (Optional)
            </label>
            <input
              type="text"
              name="reference"
              value={formData.reference}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={tt('Transaction reference, check number, etc.')}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <div className="relative">
              <div className="absolute top-3 left-3 pointer-events-none">
                <FileText className="h-5 w-5 text-gray-400" />
              </div>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={tt('Additional notes about this payment...')}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              {tt('Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !!error || !formData.amount || !formData.paymentMethod || paymentAccounts.length === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {tt('Processing...')}
                </>
              ) : (
                'Record Payment'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PartialPaymentModal;
