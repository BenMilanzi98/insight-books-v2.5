"use client";

import { useState, useEffect } from 'react';
import { Save, AlertCircle, Loader } from 'lucide-react';
import { usePaymentAccounts } from '@/hooks/usePaymentAccounts';
import DynamicCategorySelect from '@/components/DynamicCategorySelect';
import SupplierExpenseSelect from '@/components/purchases/SupplierExpenseSelect';

// Expense Form Component used for both creating and editing expenses
const ExpenseForm = ({
  expense = null,
  onSubmit,
  onCancel,
  isLoading = false,
  categories = []
}) => {
  // Form state
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    expenseAccountId: '',
    merchant: '',
    supplierId: '',
    paymentMethod: '',
    notes: '',
    status: 'Approved',
    paymentStatus: 'Fully paid',
    paidAmount: '',
    paymentReference: ''
  });
  // Validation state
  const [errors, setErrors] = useState({});
  const [formTouched, setFormTouched] = useState(false);
  
  // NEW: State for adding new categories
  const [availableCategories, setAvailableCategories] = useState([]);

  // Load payment accounts dynamically
  const { paymentAccounts, isLoading: isLoadingPaymentAccounts } = usePaymentAccounts();

  // NEW: Load categories from API
  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories?type=expense');
      if (response.ok) {
        const data = await response.json();
        setAvailableCategories(Array.isArray(data.categories) ? data.categories : []);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  useEffect(() => {
    loadCategories(); // NEW: Load categories
  }, []);

  // Initialize form with expense data if it exists
  useEffect(() => {
    if (expense) {
      // Format amount to show as a plain number in the input field 
      // (assuming amount comes in as a formatted string with commas)
      const formattedAmount = typeof expense.amount === 'string' 
        ? expense.amount.replace(/,/g, '')
        : expense.amount;

      setFormData({
        description: expense.description || '',
        amount: formattedAmount || '',
        date: expense.date || new Date().toISOString().split('T')[0],
        expenseAccountId: expense.expenseAccountId || '',
        merchant: expense.merchant || '',
        supplierId: expense.supplierId || '',
        paymentMethod: expense.paymentMethod || '',
        notes: expense.notes || '',
        status: 'Approved',
        paymentStatus: expense.paymentStatus || 'Fully paid',
        paidAmount: expense.paidAmount || '',
        paymentReference: expense.paymentReference || ''
      });
    }
  }, [expense]);

  // useEffect(() => {
  //   async function fetchAccounts() {
  //     try {
  //       const response = await fetch("/api/accounts");  // Replace with your actual API URL
  //       if (!response.ok) throw new Error("Failed to load accounts");
  //       const data = await response.json();
  //       setSourceAccounts(data.accounts || []);
  //     } catch (err) {
  //       console.error("Error loading accounts:", err);
  //     }
  //   }

  //   fetchAccounts();
  // }, []);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // For amount field, allow empty string or convert to number
    let processedValue;
    if (name === 'amount') {
      processedValue = value === '' ? '' : parseFloat(value) || '';
    } else {
      processedValue = value;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
    
    // Clear error for this field when user changes it
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
    
    // Mark form as touched
    if (!formTouched) {
      setFormTouched(true);
    }
  };


  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (formData.amount === '' || formData.amount <= 0) {
      newErrors.amount = 'Amount is required and must be greater than zero';
    }
    
    if (!formData.date) {
      newErrors.date = 'Date is required';
    }
    
    if (!formData.expenseAccountId) {
      newErrors.expenseAccountId = 'Expense account is required';
    }
    
    // Validate payment method only when not Pending
    if (formData.paymentStatus !== 'Pending' && !formData.paymentMethod) {
      newErrors.paymentMethod = 'Payment method is required';
    }
    
    // Validate payment status fields
    if (formData.paymentStatus === 'Partially') {
      if (!formData.paidAmount || formData.paidAmount <= 0) {
        newErrors.paidAmount = 'Paid amount is required for partial payments';
      } else if (parseFloat(formData.paidAmount) >= parseFloat(formData.amount)) {
        newErrors.paidAmount = 'Paid amount must be less than the total amount';
      }
      // Payment reference is now optional - no validation required
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      // Format data for submission
      const selectedAccount = availableCategories.find(acc => acc.id === formData.expenseAccountId);
      const submission = {
        ...formData,
        // Ensure amount is a number
        amount: parseFloat(formData.amount),
        category: selectedAccount?.name || expense?.category || '',
        expenseAccountId: formData.expenseAccountId,
        // Handle payment method - set to null for pending expenses
        paymentMethod: formData.paymentStatus === 'Pending' ? null : formData.paymentMethod,
        // Handle payment status fields
        paidAmount: formData.paymentStatus === 'Partially' ? parseFloat(formData.paidAmount) : null,
        paymentReference: formData.paymentStatus === 'Partially' ? (formData.paymentReference || null) : null
      };
      
      onSubmit(submission);
    }
  };

  // Format amount with commas for display (e.g., 1,234.56)
  const formatAmountDisplay = (amount) => {
    if (!amount) return '';
    
    // Convert to number and format with commas
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return amount;
    
    return numAmount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };


  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Description Field */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description*
            </label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className={`w-full p-2 border rounded-md ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Brief description of expense"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.description}
              </p>
            )}
          </div>

          {/* Amount Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (MK)*
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <span className="text-gray-500">MK</span>
              </div>
              <input
                type="text"
                name="amount"
                value={formData.amount === 0 || formData.amount === '' ? '' : formData.amount}
                onChange={handleChange}
                className={`w-full p-2 pl-10 border rounded-md ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="0.00"
              />
            </div>
            {errors.amount ? (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.amount}
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-500">
                Display: MK {formatAmountDisplay(formData.amount)}
              </p>
            )}
          </div>

          {/* Date Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date*
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className={`w-full p-2 border rounded-md ${
                errors.date ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.date}
              </p>
            )}
          </div>

          {/* Expense Account Field */}
          <div>
            <DynamicCategorySelect
              value={formData.expenseAccountId}
              onChange={(value) => setFormData(prev => ({ ...prev, expenseAccountId: value }))}
              options={availableCategories}
              placeholder="Select expense account"
              required={true}
              label="Expense Account"
            />
            <p className="mt-1 text-xs text-gray-500">
              Need a new category? Create an Expense account in the{" "}
              <a href="/chart-of-accounts" className="text-blue-600 hover:text-blue-800 underline">
                Chart of Accounts
              </a>
              .
            </p>
            {errors.expenseAccountId && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.expenseAccountId}
              </p>
            )}
          </div>

          {/* Merchant Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Merchant
            </label>
            <input
              type="text"
              name="merchant"
              value={formData.merchant}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Vendor or merchant name"
            />
          </div>

          {/* Supplier Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supplier (Optional)
            </label>
            <SupplierExpenseSelect
              value={formData.supplierId}
              onChange={(supplierId) => setFormData(prev => ({ ...prev, supplierId }))}
              status="active"
            />
            <p className="mt-1 text-xs text-gray-500">
              Link this expense to a supplier for tracking and reporting
            </p>
          </div>

          {/* Source of Funds - Only show when not Pending */}
          {formData.paymentStatus !== 'Pending' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source of Funds
              </label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
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
              {errors.paymentMethod && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.paymentMethod}
                  </p>
              )}
            </div>
          )}

          {/* Payment Status Field */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Status
            </label>
            <select
              name="paymentStatus"
              value={formData.paymentStatus}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
              required
            >
              <option value="Fully paid">Fully paid</option>
              <option value="Partially">Partially</option>
              <option value="Pending">Pending</option>
            </select>
          </div>

          {/* Partial Payment Fields - Only show when "Partially" is selected */}
          {formData.paymentStatus === 'Partially' && (
            <>
              {/* Amount Paid Field */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount Paid
                </label>
                <input
                  type="number"
                  name="paidAmount"
                  value={formData.paidAmount}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded-md ${
                    errors.paidAmount ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter amount paid"
                  step="0.01"
                  min="0"
                />
                {errors.paidAmount && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.paidAmount}
                  </p>
                )}
              </div>
              
              {/* Payment Reference Field */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Reference
                </label>
                <input
                  type="text"
                  name="paymentReference"
                  value={formData.paymentReference}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded-md ${
                    errors.paymentReference ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter payment reference (e.g., check number, transaction ID)"
                />
                {errors.paymentReference && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.paymentReference}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Notes Field */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Additional details or notes about this expense"
            ></textarea>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || (!formTouched && !expense)}
            className={`px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center ${
              (isLoading || (!formTouched && !expense)) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {expense ? 'Update Expense' : 'Create Expense'}
              </>
            )}
          </button>
        </div>
      </form>
      
    </div>
  );
};

export default ExpenseForm;