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
    notes: '',
    applyWithholding: false,
    withholdingPercent: '',
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
        notes: '',
        applyWithholding: false,
        withholdingPercent: '',
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

  const previewWithholding = () => {
    const cash = parseFloat(formData.amount) || 0;
    const pct = parseFloat(formData.withholdingPercent) || 0;
    if (!formData.applyWithholding || pct <= 0 || pct >= 100) {
      return { cash, wht: 0, gross: cash };
    }
    const wht = Math.round(((cash * pct) / (100 - pct)) * 100) / 100;
    return { cash, wht, gross: Math.round((cash + wht) * 100) / 100 };
  };

  const whtPreview = previewWithholding();

  const handleAmountChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      amount: value
    }));
    
    const amount = parseFloat(value) || 0;
    const { gross } = previewWithholdingFrom(amount, formData.applyWithholding, formData.withholdingPercent);
    if (gross > remainingBalance) {
      setError(`Total applied (cash + WHT) cannot exceed remaining balance of ${remainingBalance.toFixed(2)}`);
    } else if (amount <= 0) {
      setError('Amount must be greater than 0');
    } else {
      setError('');
    }
  };

  function previewWithholdingFrom(cash, applyWht, pctStr) {
    const pct = parseFloat(pctStr) || 0;
    if (!applyWht || pct <= 0 || pct >= 100) {
      return { cash, wht: 0, gross: cash };
    }
    const wht = Math.round(((cash * pct) / (100 - pct)) * 100) / 100;
    return { cash, wht, gross: Math.round((cash + wht) * 100) / 100 };
  }

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

    if (parseFloat(formData.amount) > remainingBalance && !formData.applyWithholding) {
      setError(`Amount cannot exceed remaining balance of ${remainingBalance.toFixed(2)}`);
      return;
    }

    const { gross, wht } = previewWithholding();
    if (gross > remainingBalance) {
      setError(`Total applied (cash + WHT ${wht.toFixed(2)}) exceeds remaining balance`);
      return;
    }

    if (formData.applyWithholding) {
      const pct = parseFloat(formData.withholdingPercent);
      if (!pct || pct <= 0 || pct >= 100) {
        setError('Enter a valid withholding percentage (0–99.99)');
        return;
      }
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
          ...formData,
          applyWithholding: formData.applyWithholding,
          withholdingPercent: formData.applyWithholding ? formData.withholdingPercent : undefined,
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

          {/* Payment Amount (cash received) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {formData.applyWithholding ? tt('Cash received *') : tt('Payment Amount *')}
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
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {formData.applyWithholding
                ? `${tt('Applied to invoice')}: ${formatCurrency(whtPreview.gross)} (${tt('incl. WHT')} ${formatCurrency(whtPreview.wht)})`
                : `${tt('Maximum')}: ${formatCurrency(remainingBalance)}`}
            </p>
          </div>

          {/* Optional withholding tax */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={formData.applyWithholding}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, applyWithholding: e.target.checked }));
                  setError('');
                }}
              />
              {tt('Apply withholding tax (WHT)')}
            </label>
            {formData.applyWithholding ? (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {tt('Withholding % on gross payment')}
                </label>
                <input
                  type="number"
                  name="withholdingPercent"
                  value={formData.withholdingPercent}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0.01"
                  max="99.99"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g. 10"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {tt('Posts Dr Cash + Dr WHT receivable, Cr AR for the full amount cleared.')}
                </p>
              </div>
            ) : null}
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
              <option value="">{isLoadingPaymentAccounts ? tt('Loading accounts...') : tt('Select an account')}</option>
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
