"use client";

import { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, FileText, Building, CreditCard, Hash, StickyNote, History, Loader } from 'lucide-react';
import DynamicCategorySelect from '@/components/DynamicCategorySelect';
import { usePaymentAccounts } from '@/hooks/usePaymentAccounts';

const HistoricalExpenseModal = ({ isOpen, onClose, onSubmit, isSubmitting = false }) => {
  const [formData, setFormData] = useState({
    historicalDate: '',
    description: '',
    amount: '',
    expenseAccountId: '',
    merchant: '',
    paymentMethod: '',
    originalReference: '',
    notes: '',
    paymentStatus: 'Fully paid',
    paidAmount: '',
    paymentReference: ''
  });

  const [errors, setErrors] = useState({});
  const [availableCategories, setAvailableCategories] = useState([]);

  // Load payment accounts dynamically
  const { paymentAccounts, isLoading: isLoadingPaymentAccounts } = usePaymentAccounts();

  // Load categories from API
  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories?type=expense');
      if (response.ok) {
        const data = await response.json();
        setAvailableCategories(Array.isArray(data.categories) ? data.categories : []);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      setAvailableCategories([]);
    }
  };


  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        historicalDate: '',
        description: '',
        amount: '',
        expenseAccountId: '',
        merchant: '',
        paymentMethod: '',
        originalReference: '',
        notes: '',
        paymentStatus: 'Fully paid',
        paidAmount: '',
        paymentReference: ''
      });
      setErrors({});
      loadCategories(); // Load categories when modal opens
    }
  }, [isOpen]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.historicalDate.trim()) {
      newErrors.historicalDate = 'Historical date is required';
    } else {
      const date = new Date(formData.historicalDate);
      if (isNaN(date.getTime())) {
        newErrors.historicalDate = 'Please enter a valid date';
      } else if (date > new Date()) {
        newErrors.historicalDate = 'Historical date cannot be in the future';
      }
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        newErrors.amount = 'Please enter a valid amount greater than 0';
      }
    }

    if (!formData.expenseAccountId.trim()) {
      newErrors.expenseAccountId = 'Expense account is required';
    }

    // Validate payment method only when not Pending
    if (formData.paymentStatus !== 'Pending' && !formData.paymentMethod.trim()) {
      newErrors.paymentMethod = 'Payment method is required';
    }

    // Validate payment status fields
    if (formData.paymentStatus === 'Partially') {
      if (!formData.paidAmount || formData.paidAmount <= 0) {
        newErrors.paidAmount = 'Paid amount is required for partial payments';
      } else if (parseFloat(formData.paidAmount) >= parseFloat(formData.amount)) {
        newErrors.paidAmount = 'Paid amount must be less than the total amount';
      }
      if (!formData.paymentReference.trim()) {
        newErrors.paymentReference = 'Payment reference is required for partial payments';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Prepare data for submission
    const selectedAccount = availableCategories.find(acc => acc.id === formData.expenseAccountId);
    const submissionData = {
      ...formData,
      amount: parseFloat(formData.amount),
      date: formData.historicalDate, // Use historical date as the main date
      status: 'Approved', // Historical expenses should be approved by default
      isHistorical: true,
      historicalDate: formData.historicalDate,
      migrationBatch: `Single-Historical-${Date.now()}`,
      originalReference: formData.originalReference || null,
      // Handle payment method - set to null for pending expenses
      paymentMethod: formData.paymentStatus === 'Pending' ? null : formData.paymentMethod,
      // Handle payment status fields
      paidAmount: formData.paymentStatus === 'Partially' ? parseFloat(formData.paidAmount) : null,
      paymentReference: formData.paymentStatus === 'Partially' ? formData.paymentReference : null,
      notes: formData.notes || null,
      category: selectedAccount?.name || ''
    };

    onSubmit(submissionData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <History className="h-6 w-6 text-blue-600 mr-3" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Add Historical Expense</h2>
              <p className="text-sm text-gray-600 mt-1">Record an expense that occurred in the past</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSubmitting}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="mx-6 mt-6 bg-amber-50 border border-amber-200 rounded-md p-4">
          <div className="flex">
            <Calendar className="h-5 w-5 text-amber-400 flex-shrink-0" />
            <div className="ml-3">
              <h4 className="text-sm font-medium text-amber-800">Historical Entry</h4>
              <p className="text-sm text-amber-700 mt-1">
                This expense will be recorded with the historical date you specify and will affect account balances.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Historical Date */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Historical Date *
              </label>
              <input
                type="date"
                value={formData.historicalDate}
                onChange={(e) => handleInputChange('historicalDate', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.historicalDate ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={isSubmitting}
              />
              {errors.historicalDate && (
                <p className="text-red-500 text-sm mt-1">{errors.historicalDate}</p>
              )}
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="h-4 w-4 inline mr-1" />
                Description *
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.description ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter expense description"
                disabled={isSubmitting}
              />
              {errors.description && (
                <p className="text-red-500 text-sm mt-1">{errors.description}</p>
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="h-4 w-4 inline mr-1" />
                Amount *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="0.00"
                disabled={isSubmitting}
              />
              {errors.amount && (
                <p className="text-red-500 text-sm mt-1">{errors.amount}</p>
              )}
            </div>

            {/* Expense Account */}
            <div>
              <DynamicCategorySelect
                value={formData.expenseAccountId}
                onChange={(value) => handleInputChange('expenseAccountId', value)}
                options={availableCategories}
                placeholder="Select expense account"
                label="Expense Account"
                required={true}
                disabled={isSubmitting}
                className={errors.expenseAccountId ? 'border-red-500' : ''}
              />
              {errors.expenseAccountId && (
                <p className="text-red-500 text-sm mt-1">{errors.expenseAccountId}</p>
              )}
            </div>

            {/* Merchant */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building className="h-4 w-4 inline mr-1" />
                Merchant
              </label>
              <input
                type="text"
                value={formData.merchant}
                onChange={(e) => handleInputChange('merchant', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter merchant name"
                disabled={isSubmitting}
              />
            </div>

            {/* Payment Method - Only show when not Pending */}
            {formData.paymentStatus !== 'Pending' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <CreditCard className="h-4 w-4 inline mr-1" />
                  Payment Method *
                </label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.paymentMethod ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting}
                >
                  <option value="">{isLoadingPaymentAccounts ? 'Loading accounts...' : 'Select an account'}</option>
                  {paymentAccounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name} {account.accountType ? `(${account.accountType})` : ''}
                    </option>
                  ))}
                </select>
                {errors.paymentMethod && (
                  <p className="text-red-500 text-sm mt-1">{errors.paymentMethod}</p>
                )}
              </div>
            )}

            {/* Payment Status */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <CreditCard className="h-4 w-4 inline mr-1" />
                Payment Status
              </label>
              <select
                value={formData.paymentStatus}
                onChange={(e) => handleInputChange('paymentStatus', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting}
              >
                <option value="Fully paid">Fully paid</option>
                <option value="Partially">Partially</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            {/* Partial Payment Fields - Only show when "Partially" is selected */}
            {formData.paymentStatus === 'Partially' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <DollarSign className="h-4 w-4 inline mr-1" />
                    Amount Paid
                  </label>
                  <input
                    type="number"
                    value={formData.paidAmount}
                    onChange={(e) => handleInputChange('paidAmount', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.paidAmount ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter amount paid"
                    step="0.01"
                    min="0"
                    disabled={isSubmitting}
                  />
                  {errors.paidAmount && (
                    <p className="text-red-500 text-sm mt-1">{errors.paidAmount}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Hash className="h-4 w-4 inline mr-1" />
                    Payment Reference
                  </label>
                  <input
                    type="text"
                    value={formData.paymentReference}
                    onChange={(e) => handleInputChange('paymentReference', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.paymentReference ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter payment reference (e.g., check number, transaction ID)"
                    disabled={isSubmitting}
                  />
                  {errors.paymentReference && (
                    <p className="text-red-500 text-sm mt-1">{errors.paymentReference}</p>
                  )}
                </div>
              </>
            )}

            {/* Original Reference */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Hash className="h-4 w-4 inline mr-1" />
                Original Reference
              </label>
              <input
                type="text"
                value={formData.originalReference}
                onChange={(e) => handleInputChange('originalReference', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Original invoice/receipt number"
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500 mt-1">
                Reference number from the original receipt or invoice
              </p>
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <StickyNote className="h-4 w-4 inline mr-1" />
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Additional notes about this expense"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-6 py-2 rounded-md text-white font-medium transition-colors flex items-center ${
                isSubmitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <History className="h-4 w-4 mr-2" />
                  Create Historical Expense
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HistoricalExpenseModal;
