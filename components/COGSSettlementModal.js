// components/COGSSettlementModal.js
"use client";
import { tt } from '@/lib/i18n/runtime';
import { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, CreditCard, FileText, AlertCircle, Loader } from 'lucide-react';
import { usePaymentAccounts } from '@/hooks/usePaymentAccounts';

const COGSSettlementModal = ({ isOpen, onClose, onSettle, isLoading, totalCOGS = 0 }) => {
  const { paymentAccounts, isLoading: isLoadingPaymentAccounts } = usePaymentAccounts();
  const [formData, setFormData] = useState({
    amount: totalCOGS > 0 ? totalCOGS.toString() : '',
    description: totalCOGS > 0 ? `Total COGS Settlement - MK ${totalCOGS.toLocaleString()}` : '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: '',
    notes: ''
  });
  const [errors, setErrors] = useState({});

  // Update form data when modal opens or totalCOGS changes
  useEffect(() => {
    if (isOpen && totalCOGS > 0 && paymentAccounts.length > 0) {
      // Set default payment method to first available account (prefer Cash)
      const defaultAccount = paymentAccounts.find(acc => acc.accountType === 'Cash' && acc.isActive) || paymentAccounts[0];
      setFormData({
        amount: totalCOGS.toString(),
        description: `Total COGS Settlement - MK ${totalCOGS.toLocaleString()}`,
        date: new Date().toISOString().split('T')[0],
        paymentMethod: defaultAccount?.id || '',
        notes: ''
      });
    }
  }, [isOpen, totalCOGS, paymentAccounts]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    
    if (!formData.date) {
      newErrors.date = 'Date is required';
    }
    
    if (!formData.paymentMethod) {
      newErrors.paymentMethod = 'Payment method is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    onSettle(formData);
  };

  const handleClose = () => {
    setFormData({
      amount: totalCOGS > 0 ? totalCOGS.toString() : '',
      description: totalCOGS > 0 ? `Total COGS Settlement - MK ${totalCOGS.toLocaleString()}` : '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'cash',
      notes: ''
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{tt('Record Total COGS as Expense')}</h2>
              <p className="text-sm text-gray-500">{tt('Record the accumulative COGS total as an expense')}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {tt('Settlement Amount *')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                className={`block w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.amount ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="0.00"
                step="0.01"
                min="0"
                disabled={isLoading}
              />
            </div>
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.amount}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {tt('Description')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FileText className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={tt('COGS Settlement Description')}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {tt('Settlement Date *')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                className={`block w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.date ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={isLoading}
              />
            </div>
            {errors.date && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.date}
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {tt('Payment Method *')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <CreditCard className="h-5 w-5 text-gray-400" />
              </div>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleInputChange}
                className={`block w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.paymentMethod ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={isLoading || isLoadingPaymentAccounts}
              >
                <option value="">{isLoadingPaymentAccounts ? tt('Loading accounts...') : tt('Select an account')}</option>
                {paymentAccounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name} {account.accountType ? `(${account.accountType})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {errors.paymentMethod && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.paymentMethod}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {tt('Notes')}
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={tt('Additional notes about this COGS settlement...')}
              disabled={isLoading}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={isLoading}
            >
              {tt('Cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {tt('Recording...')}
                </div>
              ) : (
                'Record as Expense'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default COGSSettlementModal;

