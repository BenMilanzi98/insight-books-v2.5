"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState, useEffect, useRef } from 'react';
import { Save, AlertCircle, Loader, ChevronDown, Plus, X } from 'lucide-react';
import { usePaymentAccounts } from '@/hooks/usePaymentAccounts';
import DynamicCategorySelect from '@/components/DynamicCategorySelect';
import SupplierExpenseSelect from '@/components/purchases/SupplierExpenseSelect';
import AddTransferFundsPanel from '@/components/payments/AddTransferFundsPanel';
import { percentOfMoney } from '@/lib/money';
import {
  checkPaymentAccountFunds,
  formatPaymentAccountOptionLabel,
  getCashOutflowRequired,
} from '@/lib/paymentAccountFunds';

// Expense Form Component used for both creating and editing expenses
const ExpenseForm = ({
  expense = null,
  onSubmit,
  onCancel,
  isLoading = false,
  categories = [],
}) => {
  // Form state — posted expenses are Approved by default (no approval workflow UI)
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    taxAmount: '',
    taxRate: '',
    date: new Date().toISOString().split('T')[0],
    expenseAccountId: '',
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
  const [postingPreview, setPostingPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [fundsCheck, setFundsCheck] = useState(null); // null | { ok:false, ... }
  const [showFundPanel, setShowFundPanel] = useState(false);

  // Tax types state and default for outflow (expenses/purchases) - auto-populated from settings
  const [taxTypes, setTaxTypes] = useState([]);
  const [defaultTaxTypeForOutflow, setDefaultTaxTypeForOutflow] = useState(null);
  const [defaultTaxOutflowAccountId, setDefaultTaxOutflowAccountId] = useState(null);
  const [taxDropdownOpen, setTaxDropdownOpen] = useState(false);
  const [taxSearch, setTaxSearch] = useState('');
  const [isAddingTax, setIsAddingTax] = useState(false);
  const [newTax, setNewTax] = useState({ taxName: '', taxRate: '', accountId: '' });
  const [taxAccounts, setTaxAccounts] = useState([]);
  const [addingTaxLoading, setAddingTaxLoading] = useState(false);
  const [selectedTaxTypeId, setSelectedTaxTypeId] = useState('');
  const taxDropdownRef = useRef(null);
  const taxesAvailable = taxTypes.length > 0;
  const showTaxFields =
    taxesAvailable ||
    (parseFloat(formData.taxAmount) || 0) > 0 ||
    (parseFloat(formData.taxRate) || 0) > 0;

  const [availableCategories, setAvailableCategories] = useState([]);

  // Load payment accounts dynamically
  const {
    paymentAccounts,
    isLoading: isLoadingPaymentAccounts,
    refresh: refreshPaymentAccounts,
  } = usePaymentAccounts();

  // Load expense categories from active, postable Chart of Accounts expense accounts.
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
    loadCategories();
  }, []);

  // Fetch active tax types and default tax for outflow (expenses)
  const fetchTaxTypes = async () => {
    try {
      const [taxRes, defaultsRes] = await Promise.all([
        fetch('/api/tax-types?status=Active'),
        fetch('/api/settings/tax-defaults').catch(() => null)
      ]);
      if (taxRes.ok) {
        const data = await taxRes.json();
        setTaxTypes(Array.isArray(data.taxTypes) ? data.taxTypes : []);
      }
      if (defaultsRes?.ok) {
        const defaults = await defaultsRes.json();
        setDefaultTaxTypeForOutflow(defaults.defaultTaxTypeForOutflow || null);
        setDefaultTaxOutflowAccountId(defaults.taxOutflowAccountId || null);
      }
    } catch (err) {
      console.error('Error loading tax types:', err);
    }
  };

  useEffect(() => {
    fetchTaxTypes();
  }, []);

  // Auto-populate default tax (outflow) once when creating a new expense
  const appliedDefaultTaxRef = useRef(false);
  useEffect(() => {
    if (expense || !defaultTaxTypeForOutflow || appliedDefaultTaxRef.current || !taxesAvailable) return;
    appliedDefaultTaxRef.current = true;
    setSelectedTaxTypeId(defaultTaxTypeForOutflow.id);
    const rate = Number(defaultTaxTypeForOutflow.taxRate) || 0;
    setFormData(prev => {
      const next = { ...prev, taxRate: rate };
      if (typeof prev.amount === 'number' && prev.amount > 0 && rate > 0) {
        next.taxAmount = percentOfMoney(prev.amount, rate);
      } else if (prev.amount !== '' && prev.amount !== undefined && rate > 0) {
        const amt = Number(prev.amount);
        if (!Number.isNaN(amt) && amt > 0) next.taxAmount = percentOfMoney(amt, rate);
      }
      return next;
    });
  }, [defaultTaxTypeForOutflow?.id, expense, taxesAvailable]);

  // Close tax dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (taxDropdownRef.current && !taxDropdownRef.current.contains(e.target)) {
        setTaxDropdownOpen(false);
        setIsAddingTax(false);
        setTaxSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize form with expense data if it exists
  useEffect(() => {
    if (expense) {
      // Format amount to show as a plain number in the input field 
      // (assuming amount comes in as a formatted string with commas)
      const rawAmount = typeof expense.amount === 'string'
        ? parseFloat(expense.amount.replace(/,/g, ''))
        : Number(expense.amount);
      const formattedAmount = Number.isNaN(rawAmount) ? '' : rawAmount;

      const rawTaxAmt = expense.taxAmount != null ? Number(expense.taxAmount) : '';
      const rawTaxRt = expense.taxRate != null ? Number(expense.taxRate) : '';
      setFormData({
        description: expense.description || '',
        amount: formattedAmount,
        taxAmount: rawTaxAmt === '' || Number.isNaN(rawTaxAmt) ? '' : rawTaxAmt,
        taxRate: rawTaxRt === '' || Number.isNaN(rawTaxRt) ? '' : rawTaxRt,
        date: expense.date || new Date().toISOString().split('T')[0],
        expenseAccountId: expense.expenseAccountId || '',
        supplierId: expense.supplierId || '',
        paymentMethod: expense.paymentMethod || '',
        notes: expense.notes || '',
        status: expense.status || 'Approved',
        paymentStatus: expense.paymentStatus || 'Fully paid',
        paidAmount: expense.paidAmount || '',
        paymentReference: expense.paymentReference || ''
      });
      setPostingPreview(null);
      setPreviewError('');
    } else {
      setFormData((prev) => ({
        ...prev,
        status: 'Approved',
      }));
      setPostingPreview(null);
      setPreviewError('');
    }
  }, [expense]);

  // When editing, try to match existing taxRate to a tax type
  useEffect(() => {
    if (expense && taxTypes.length > 0 && formData.taxRate !== '' && !selectedTaxTypeId) {
      const rate = Number(formData.taxRate);
      const match = taxTypes.find(t => Number(t.taxRate) === rate);
      if (match) setSelectedTaxTypeId(match.id);
    }
  }, [expense, taxTypes, formData.taxRate]);

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

  // Handle selecting a tax type from the dropdown
  const handleSelectTaxType = (taxType) => {
    const rate = Number(taxType.taxRate) || 0;
    setSelectedTaxTypeId(taxType.id);
    setFormData(prev => {
      const next = { ...prev, taxRate: rate };
      if (typeof prev.amount === 'number' && prev.amount > 0 && rate > 0) {
        next.taxAmount = percentOfMoney(prev.amount, rate);
      } else {
        next.taxAmount = '';
      }
      return next;
    });
    setTaxDropdownOpen(false);
    setTaxSearch('');
    if (!formTouched) setFormTouched(true);
  };

  // Clear tax selection
  const handleClearTax = () => {
    setSelectedTaxTypeId('');
    setFormData(prev => ({ ...prev, taxRate: '', taxAmount: '' }));
    if (!formTouched) setFormTouched(true);
  };

  // Fetch tax-eligible accounts for the inline create form
  const fetchTaxAccounts = async () => {
    try {
      const res = await fetch('/api/tax-types/accounts');
      if (res.ok) {
        const data = await res.json();
        setTaxAccounts(Array.isArray(data.accounts) ? data.accounts : []);
      }
    } catch (err) {
      console.error('Error loading tax accounts:', err);
    }
  };

  // Handle creating a new tax type inline
  const handleCreateTaxType = async () => {
    if (!newTax.taxName.trim() || newTax.taxRate === '' || !newTax.accountId) return;
    setAddingTaxLoading(true);
    try {
      const taxId = newTax.taxName.trim().toUpperCase().replace(/\s+/g, '-');
      const res = await fetch('/api/tax-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxId,
          taxName: newTax.taxName.trim(),
          taxRate: parseFloat(newTax.taxRate),
          calculationType: 'Percentage',
          accountId: newTax.accountId,
          status: 'Inactive',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to create tax type');
        return;
      }
      await fetchTaxTypes();
      alert('Tax created as Inactive. Activate it under Tax Management → Tax accounts before using it.');
      setIsAddingTax(false);
      setNewTax({ taxName: '', taxRate: '', accountId: '' });
    } catch (err) {
      console.error('Error creating tax type:', err);
      alert('Failed to create tax type');
    } finally {
      setAddingTaxLoading(false);
    }
  };

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    let processedValue;
    if (name === 'amount' || name === 'taxAmount' || name === 'taxRate') {
      if (value === '') {
        processedValue = '';
      } else {
        const stripped = String(value).replace(/,/g, '');
        const parsed = parseFloat(stripped);
        processedValue = Number.isNaN(parsed) ? '' : parsed;
      }
    } else {
      processedValue = value;
    }

    setFormData(prev => {
      const next = { ...prev, [name]: processedValue };
      // If total (amount) or tax rate changed, optionally sync tax amount from rate (tax-inclusive)
      if (name === 'amount' && typeof processedValue === 'number' && processedValue > 0 && prev.taxRate !== '' && typeof prev.taxRate === 'number' && prev.taxRate > 0) {
        next.taxAmount = percentOfMoney(processedValue, prev.taxRate);
      }
      if (name === 'taxRate' && typeof processedValue === 'number' && processedValue > 0 && typeof prev.amount === 'number' && prev.amount > 0) {
        next.taxAmount = percentOfMoney(prev.amount, processedValue);
      }
      return next;
    });
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
    if (!formTouched) setFormTouched(true);
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
    const taxAmt = typeof formData.taxAmount === 'number' ? formData.taxAmount : parseFloat(formData.taxAmount);
    if (formData.taxAmount !== '' && !isNaN(taxAmt) && taxAmt >= parseFloat(formData.amount)) {
      newErrors.taxAmount = 'Tax amount must be less than total amount';
    }
    
    if (!formData.date) {
      newErrors.date = 'Date is required';
    }
    
    if (!formData.expenseAccountId) {
      newErrors.expenseAccountId = 'Expense category is required';
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

    // Insufficient source-of-funds balance
    if (formData.paymentStatus !== 'Pending' && formData.paymentMethod) {
      const required = getCashOutflowRequired({
        paymentStatus: formData.paymentStatus,
        amount: formData.amount,
        paidAmount: formData.paidAmount,
      });
      const check = checkPaymentAccountFunds({
        paymentAccounts,
        paymentAccountId: formData.paymentMethod,
        requiredAmount: required,
      });
      if (!check.ok) {
        newErrors.paymentMethod = `Insufficient funds. Available MWK ${Number(check.available).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, required MWK ${Number(check.required).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
        setFundsCheck(check);
        setShowFundPanel(true);
      } else {
        setFundsCheck(null);
      }
    } else {
      setFundsCheck(null);
      setShowFundPanel(false);
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildSubmission = () => {
    const selectedAccount = availableCategories.find(acc => acc.id === formData.expenseAccountId);
    const taxAmountNum = formData.taxAmount !== '' && !isNaN(parseFloat(formData.taxAmount)) ? parseFloat(formData.taxAmount) : 0;
    const taxRateNum = formData.taxRate !== '' && !isNaN(parseFloat(formData.taxRate)) ? parseFloat(formData.taxRate) : 0;
    const submission = {
      ...formData,
      // New expenses post as Approved; edits keep existing approval status (no UI to change it)
      status: expense ? (expense.status || 'Approved') : 'Approved',
      amount: parseFloat(formData.amount),
      taxAmount: taxAmountNum,
      taxRate: taxRateNum,
      taxTypeId: selectedTaxTypeId || null,
      category: selectedAccount?.name || expense?.category || '',
      expenseAccountId: formData.expenseAccountId,
      paymentMethod: formData.paymentStatus === 'Pending' ? null : formData.paymentMethod,
      paidAmount: formData.paymentStatus === 'Partially' ? parseFloat(formData.paidAmount) : null,
      paymentReference: formData.paymentStatus === 'Partially' ? (formData.paymentReference || null) : null
    };
    return submission;
  };

  const loadPostingPreview = async () => {
    if (!formData.expenseAccountId || formData.amount === '' || Number(formData.amount) <= 0) {
      setPostingPreview(null);
      setPreviewError('');
      return;
    }
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const res = await fetch('/api/expenses/preview-posting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: Number(formData.amount) || 0,
          taxAmount: formData.taxAmount === '' ? 0 : Number(formData.taxAmount) || 0,
          expenseAccountId: formData.expenseAccountId || null,
          paymentMethod: formData.paymentStatus === 'Pending' ? null : formData.paymentMethod,
          paymentStatus: formData.paymentStatus,
          supplierId: formData.supplierId || null,
          date: formData.date,
          description: formData.description,
          category: availableCategories.find((a) => a.id === formData.expenseAccountId)?.name || '',
          status: 'Approved',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load posting preview');
      setPostingPreview(data.preview || data);
    } catch (err) {
      setPostingPreview(null);
      setPreviewError(err.message || 'Failed to load posting preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      loadPostingPreview();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.amount,
    formData.taxAmount,
    formData.expenseAccountId,
    formData.paymentMethod,
    formData.paymentStatus,
    formData.supplierId,
  ]);

  const handleSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();

    if (validateForm()) {
      onSubmit(buildSubmission());
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
              {tt('Description*')}
            </label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className={`w-full p-2 border rounded-md ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={tt('Brief description of expense')}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.description}
              </p>
            )}
          </div>

          {/* Amount (excl. tax) */}
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
            ) : null}
          </div>

          {/* Tax amount (optional) */}
          {showTaxFields && (
          <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax amount (MK)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <span className="text-gray-500">MK</span>
              </div>
              <input
                type="text"
                name="taxAmount"
                value={formData.taxAmount === 0 || formData.taxAmount === '' ? '' : formData.taxAmount}
                onChange={handleChange}
                className={`w-full p-2 pl-10 border rounded-md ${
                  errors.taxAmount ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="0.00"
              />
            </div>
            {errors.taxAmount && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.taxAmount}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Total (incl. tax): MK {formatAmountDisplay((parseFloat(formData.amount) || 0) + (parseFloat(formData.taxAmount) || 0))}
            </p>
          </div>

          {/* Tax rate % (optional) - dropdown from tax-types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax rate (%)
            </label>
            <div className="relative" ref={taxDropdownRef}>
              <button
                type="button"
                onClick={() => { setTaxDropdownOpen(!taxDropdownOpen); setIsAddingTax(false); setTaxSearch(''); }}
                className={`w-full p-2 border border-gray-300 rounded-md bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${taxDropdownOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className={selectedTaxTypeId ? 'text-gray-900' : 'text-gray-500'}>
                    {selectedTaxTypeId
                      ? (() => { const t = taxTypes.find(t => t.id === selectedTaxTypeId); return t ? `${t.taxName} (${t.taxRate}%)` : `${formData.taxRate}%`; })()
                      : formData.taxRate !== '' && formData.taxRate !== 0
                        ? `${formData.taxRate}%`
                        : 'Select tax type'}
                  </span>
                  <div className="flex items-center gap-1">
                    {(selectedTaxTypeId || (formData.taxRate !== '' && formData.taxRate !== 0)) && (
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); handleClearTax(); }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X size={14} />
                      </span>
                    )}
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${taxDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </button>

              {taxDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden">
                  {!isAddingTax ? (
                    <>
                      <div className="p-2 border-b border-gray-200 flex items-center space-x-2">
                        <input
                          type="text"
                          placeholder={tt('Search tax types...')}
                          value={taxSearch}
                          onChange={(e) => setTaxSearch(e.target.value)}
                          className="flex-1 p-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => { setIsAddingTax(true); fetchTaxAccounts(); setNewTax(prev => ({ ...prev, accountId: defaultTaxOutflowAccountId || prev.accountId })); }}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                          title={tt('Add new tax type')}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {taxTypes
                          .filter(t => t.taxName.toLowerCase().includes(taxSearch.toLowerCase()))
                          .map(t => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => handleSelectTaxType(t)}
                              className={`w-full px-3 py-2 text-left hover:bg-gray-100 text-sm ${t.id === selectedTaxTypeId ? 'bg-blue-50 text-blue-700' : 'text-gray-900'}`}
                            >
                              {t.taxName} <span className="text-gray-500">({t.taxRate}%)</span>
                            </button>
                          ))}
                        {taxTypes.filter(t => t.taxName.toLowerCase().includes(taxSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-gray-500 text-sm">{tt('No tax types found')}</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="p-3 space-y-2">
                      <p className="text-sm font-medium text-gray-700">{tt('Create new tax type')}</p>
                      <input
                        type="text"
                        placeholder="Tax name (e.g. VAT)"
                        value={newTax.taxName}
                        onChange={(e) => setNewTax(prev => ({ ...prev, taxName: e.target.value }))}
                        className="w-full p-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="number"
                        placeholder="Rate % (e.g. 17.5)"
                        value={newTax.taxRate}
                        onChange={(e) => setNewTax(prev => ({ ...prev, taxRate: e.target.value }))}
                        className="w-full p-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        step="0.01"
                        min="0"
                        max="100"
                      />
                      <select
                        value={newTax.accountId}
                        onChange={(e) => setNewTax(prev => ({ ...prev, accountId: e.target.value }))}
                        className="w-full p-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">{tt('Select tax account')}</option>
                        {taxAccounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.accountCode ? `${acc.accountCode} - ` : ''}{acc.accountName || acc.name} ({acc.accountType})
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => { setIsAddingTax(false); setNewTax({ taxName: '', taxRate: '', accountId: '' }); }}
                          className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                        >
                          {tt('Cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateTaxType}
                          disabled={!newTax.taxName.trim() || newTax.taxRate === '' || !newTax.accountId || addingTaxLoading}
                          className="px-2 py-1 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {addingTaxLoading ? tt('Saving...') : tt('Save')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Select a tax type; tax amount will be calculated from the total.
            </p>
          </div>
          </>
          )}

          {/* Date Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tt('Date*')}
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

          {/* Expense Category Field */}
          <div>
            <DynamicCategorySelect
              value={formData.expenseAccountId}
              onChange={(value) => setFormData(prev => ({ ...prev, expenseAccountId: value }))}
              options={availableCategories}
              placeholder={tt('Select expense category')}
              searchPlaceholder="Search categories..."
              emptyMessage="No predefined expense accounts found for this business"
              required={true}
              label="Expense Category"
            />
            <p className="mt-1 text-xs text-gray-500">
              Expense categories come from active, postable expense accounts in{" "}
              <a href="/chart-of-accounts" className="text-blue-600 hover:text-blue-800 underline">
                {tt('Chart of Accounts')}
              </a>{" "}
              if something is missing.
            </p>
            {errors.expenseAccountId && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.expenseAccountId}
              </p>
            )}
          </div>

          {/* Supplier Field - from /purchases/suppliers with option to add new */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supplier (Optional)
            </label>
            <SupplierExpenseSelect
              value={formData.supplierId}
              onChange={(idOrEvent) => setFormData(prev => ({ ...prev, supplierId: idOrEvent?.target?.value ?? idOrEvent ?? '' }))}
              showActiveOnly={true}
              onSupplierAdded={(newSupplierId) => setFormData(prev => ({ ...prev, supplierId: newSupplierId }))}
            />
            <p className="mt-1 text-xs text-gray-500">
              Link to a supplier from Purchases; or add a new supplier (saved to Purchases → Suppliers).
            </p>
          </div>

          {/* Source of Funds - Only show when not Pending */}
          {formData.paymentStatus !== 'Pending' && (
            <div className="mb-4 col-span-1 sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tt('Source of Funds')}
              </label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={(e) => {
                  handleChange(e);
                  setShowFundPanel(false);
                  setFundsCheck(null);
                }}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
                disabled={isLoadingPaymentAccounts}
              >
                <option value="">{isLoadingPaymentAccounts ? tt('Loading accounts...') : tt('Select an account')}</option>
                {paymentAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {formatPaymentAccountOptionLabel(account)}
                  </option>
                ))}
              </select>
              {errors.paymentMethod && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.paymentMethod}
                  </p>
              )}
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
                    setErrors((prev) => ({ ...prev, paymentMethod: null }));
                    await refreshPaymentAccounts();
                  }}
                />
              )}
            </div>
          )}

          {/* Payment Status Field */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tt('Payment Status')}
            </label>
            <select
              name="paymentStatus"
              value={formData.paymentStatus}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md"
              required
            >
              <option value="Fully paid">{tt('Fully paid')}</option>
              <option value="Partially">{tt('Partially')}</option>
              <option value="Pending">{tt('Pending')}</option>
            </select>
          </div>

          {/* Partial Payment Fields - Only show when "Partially" is selected */}
          {formData.paymentStatus === 'Partially' && (
            <>
              {/* Amount Paid Field */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {tt('Amount Paid')}
                </label>
                <input
                  type="number"
                  name="paidAmount"
                  value={formData.paidAmount}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded-md ${
                    errors.paidAmount ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder={tt('Enter amount paid')}
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
                  {tt('Payment Reference')}
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
              {tt('Notes')}
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder={tt('Additional details or notes about this expense')}
            ></textarea>
          </div>

          {/* GL posting preview */}
          <div className="col-span-2 rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-800">{tt('Posting preview')}</h4>
              {previewLoading ? (
                <span className="text-xs text-gray-500 flex items-center">
                  <Loader className="w-3.5 h-3.5 mr-1 animate-spin" />
                  {tt('Updating…')}
                </span>
              ) : null}
            </div>
            {previewError ? (
              <p className="text-sm text-amber-700">{previewError}</p>
            ) : null}
            {!previewError && postingPreview?.lines?.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="py-1 pr-2 font-medium">{tt('Account')}</th>
                      <th className="py-1 pr-2 font-medium text-right">{tt('Debit')}</th>
                      <th className="py-1 font-medium text-right">{tt('Credit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {postingPreview.lines.map((line, idx) => (
                      <tr key={idx} className="border-b border-gray-100 last:border-0">
                        <td className="py-1.5 pr-2 text-gray-800">
                          {line.accountCode || line.accountName || line.accountId || '—'}
                          {line.description ? (
                            <span className="block text-gray-500 truncate max-w-[220px]">{line.description}</span>
                          ) : null}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums text-gray-900">
                          {line.debit != null && Number(line.debit) > 0
                            ? Number(line.debit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : '—'}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-gray-900">
                          {line.credit != null && Number(line.credit) > 0
                            ? Number(line.credit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(postingPreview.totalDebit != null || postingPreview.totals) && (
                  <p className="mt-2 text-xs text-gray-600">
                    Totals — Debit:{' '}
                    {Number(postingPreview.totalDebit ?? postingPreview.totals?.totalDebit ?? 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    · Credit:{' '}
                    {Number(postingPreview.totalCredit ?? postingPreview.totals?.totalCredit ?? 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                )}
              </div>
            ) : !previewError && !previewLoading ? (
              <p className="text-xs text-gray-500">
                {tt('Select an expense category and amount to preview the journal entry.')}
              </p>
            ) : null}
            {Array.isArray(postingPreview?.warnings) && postingPreview.warnings.length > 0 ? (
              <ul className="mt-2 text-xs text-amber-700 list-disc pl-4">
                {postingPreview.warnings.map((w, i) => (
                  <li key={i}>{typeof w === 'string' ? w : w.message || JSON.stringify(w)}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        {/* Form Actions — sticky within modal scroller */}
        <div className="sticky bottom-0 -mx-6 mt-2 flex justify-end space-x-3 border-t border-gray-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {tt('Cancel')}
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
                {tt('Saving...')}
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {expense ? tt('Update Expense') : tt('Create Expense')}
              </>
            )}
          </button>
        </div>
      </form>
      
    </div>
  );
};

export default ExpenseForm;
