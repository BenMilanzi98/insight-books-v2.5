"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Plus, 
  Trash2, 
  Save, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle,
  X,
  BookOpen
} from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";

const JournalEntryForm = ({ existingEntry = null }) => {
  const router = useRouter();
  const isEditing = !!existingEntry;
  const isPosted = existingEntry?.status === 'Posted' || existingEntry?.status === 'posted';
  
  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    entryType: "Correction",
    description: "",
    internalReference: "",
    lines: [
      { accountId: "", description: "", debit: "", credit: "" },
      { accountId: "", description: "", debit: "", credit: "" }
    ]
  });
  
  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Accounts for dropdown
  const [accounts, setAccounts] = useState([]);
  const [accountsByType, setAccountsByType] = useState({});
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  
  // Totals
  const [totals, setTotals] = useState({
    debit: 0,
    credit: 0,
    difference: 0,
    isBalanced: true
  });
  
  // Initialize form with existing data if editing
  useEffect(() => {
    if (existingEntry) {
      setFormData({
        date: new Date(existingEntry.date).toISOString().split('T')[0],
        entryType: existingEntry.entryType || "Correction",
        description: existingEntry.description || "",
        internalReference: existingEntry.notes || "",
        lines: existingEntry.lines.map(entry => ({
          accountId: entry.accountId || "",
          description: entry.description || "",
          debit: entry.debit > 0 ? entry.debit.toString() : "",
          credit: entry.credit > 0 ? entry.credit.toString() : ""
        }))
      });
    }
  }, [existingEntry]);
  
  // Fetch all active accounts (including child accounts) for dropdown - same as Chart of Accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      setIsLoadingAccounts(true);
      try {
        const response = await fetch('/api/accounts?forSelect=true');
        if (!response.ok) {
          throw new Error(`Error fetching accounts: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Ensure accounts have proper IDs (all active parents + children from chart of accounts)
        const validAccounts = (data.accounts || []).filter(account => account.id);
        setAccounts(validAccounts);
        
        // Group accounts by type for display
        const groupedAccounts = validAccounts.reduce((groups, account) => {
          const type = account.type || account.accountType || 'Other';
          if (!groups[type]) {
            groups[type] = [];
          }
          groups[type].push(account);
          return groups;
        }, {});
        
        setAccountsByType(groupedAccounts);
      } catch (err) {
        console.error("Error fetching accounts:", err);
        setError("Failed to load accounts. Please try again.");
      } finally {
        setIsLoadingAccounts(false);
      }
    };
    
    fetchAccounts();
  }, []);
  
  // Calculate totals whenever entries change
  useEffect(() => {
    const debitTotal = formData.lines.reduce((sum, entry) => {
      const amount = parseFloat(entry.debit) || 0;
      return sum + amount;
    }, 0);
    
    const creditTotal = formData.lines.reduce((sum, entry) => {
      const amount = parseFloat(entry.credit) || 0;
      return sum + amount;
    }, 0);
    
    const difference = Math.abs(debitTotal - creditTotal);
    const isBalanced = difference < 0.001; // Allow for small floating point differences
    
    setTotals({
      debit: debitTotal,
      credit: creditTotal,
      difference,
      isBalanced
    });
  }, [formData.lines]);
  
  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle entry changes
  const handleEntryChange = (index, field, value) => {
    const newEntries = [...formData.lines];
    
    // If changing from debit to credit or vice versa, clear the other field
    if (field === 'debit' && value !== '' && newEntries[index].credit !== '') {
      newEntries[index].credit = '';
    } else if (field === 'credit' && value !== '' && newEntries[index].debit !== '') {
      newEntries[index].debit = '';
    }
    
    // Update the field
    newEntries[index][field] = value;
    
    setFormData(prev => ({
      ...prev,
      lines: newEntries
    }));
  };
  
  // Add new entry row
  const addEntry = () => {
    setFormData(prev => ({
      ...prev,
      lines: [
        ...prev.lines,
        { accountId: "", description: "", debit: "", credit: "" }
      ]
    }));
  };
  
  // Remove entry row
  const removeEntry = (index) => {
    if (formData.lines.length <= 2) {
      setError("Journal entries must have at least two lines");
      return;
    }
    
    const newEntries = [...formData.lines];
    newEntries.splice(index, 1);
    
    setFormData(prev => ({
      ...prev,
      lines: newEntries
    }));
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    // Validate form
    if (!formData.date || !formData.description) {
      setError("Date and description are required");
      return;
    }
    
    if (formData.lines.length < 2) {
      setError("Journal entries must have at least two lines");
      return;
    }
    
    // Validate each entry
    let isValid = true;
    formData.lines.forEach((entry, index) => {
      if (!entry.accountId) {
        setError(`Account is required for entry #${index + 1}`);
        isValid = false;
        return;
      }
      
      if (!entry.debit && !entry.credit) {
        setError(`Entry #${index + 1} must have either a debit or credit amount`);
        isValid = false;
        return;
      }
    });
    
    if (!isValid) return;
    
    // Validate that debits = credits
    if (!totals.isBalanced) {
      setError("Journal entry must balance (total debits must equal total credits)");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Check if all account IDs are valid
      const selectedAccountIds = formData.lines.map(line => line.accountId);
      const availableAccountIds = accounts.map(account => account.id);
      
      const invalidAccountIds = selectedAccountIds.filter(id => !availableAccountIds.includes(id));
      
      if (invalidAccountIds.length > 0) {
        throw new Error(`Invalid account IDs selected: ${invalidAccountIds.join(', ')}`);
      }
      
      // Prepare data for API
      const apiData = {
        date: formData.date,
        entryType: formData.entryType,
        description: formData.description,
        internalReference: formData.internalReference,
        status: 'Draft', // Add status since the API expects it
        lines: formData.lines.map(entry => ({
          accountId: entry.accountId,
          description: entry.description,
          debit: entry.debit ? parseFloat(entry.debit) : 0,
          credit: entry.credit ? parseFloat(entry.credit) : 0
        }))
      };
      
      // Log the data being sent to the API for debugging
      console.log('Submitting journal entry:', apiData);
      
      // Determine if creating or updating
      const url = isEditing 
        ? `/api/journal-entries/${existingEntry.id}` 
        : '/api/journal-entries';
      
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('API error response:', errorData);
        throw new Error(errorData.error || `Failed to ${isEditing ? 'update' : 'create'} journal entry`);
      }
      
      const result = await response.json();
      console.log('API success response:', result);
      
      setSuccess(`Journal entry ${isEditing ? 'updated' : 'created'} successfully`);
      
      // Redirect after a short delay
      setTimeout(() => {
        router.push('/general-ledger');
      }, 1500);
      
    } catch (err) {
      console.error("Error submitting form:", err);
      setError(err.message || `Failed to ${isEditing ? 'update' : 'create'} journal entry`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Cancel and go back
  const handleCancel = () => {
    router.back();
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      <div className="container mx-auto px-4 sm:px-6 py-6 lg:py-8 max-w-5xl">
        {/* Header */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 shadow-xl shadow-indigo-200/50 p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleCancel}
              className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              <ArrowLeft size={22} />
            </button>
            <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {isEditing ? 'Edit Journal Entry' : 'New Journal Entry'}
              </h1>
              <p className="text-indigo-100 text-sm mt-0.5">Create or edit a general ledger entry</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 px-4 py-3 mb-6 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-2">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
            <button type="button" onClick={() => setError(null)} className="text-red-600 hover:text-red-800 font-bold">×</button>
          </div>
        )}

        {success && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 mb-6 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle size={20} />
              <span>{success}</span>
            </div>
            <button type="button" onClick={() => setSuccess(null)} className="text-emerald-600 hover:text-emerald-800 font-bold">×</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-100 p-6 sm:p-8">
          {isPosted && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Posted entries are read-only. Corrections must be made via reversal or a new adjusting entry.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="date">Date <span className="text-rose-500">*</span></label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="entryType">Entry Type <span className="text-rose-500">*</span></label>
              <select
                id="entryType"
                name="entryType"
                value={formData.entryType}
                onChange={handleChange}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
                required
              >
                <option value="Correction">Correction</option>
                <option value="Accrual">Accrual</option>
                <option value="Opening Balance">Opening Balance</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="description">Description <span className="text-rose-500">*</span></label>
              <input
                type="text"
                id="description"
                name="description"
                placeholder="Enter a description for this journal entry"
                value={formData.description}
                onChange={handleChange}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="internalReference">Internal Reference / Tag</label>
              <input
                type="text"
                id="internalReference"
                name="internalReference"
                placeholder="Optional internal reference or tag"
                value={formData.internalReference}
                onChange={handleChange}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
              />
            </div>
          </div>

          <div className="mb-8">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Entry Lines</h2>
              <button
                type="button"
                onClick={addEntry}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-100 text-indigo-700 font-medium hover:bg-indigo-200 transition-colors"
              >
                <Plus size={18} />
                Add Line
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200">
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Account <span className="text-rose-500">*</span></th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-amber-600 uppercase tracking-wider">Debit</th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-emerald-600 uppercase tracking-wider">Credit</th>
                    <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-16">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {formData.lines.map((entry, index) => (
                    <tr key={index} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-4 py-3">
                        {isLoadingAccounts ? (
                          <div className="animate-pulse h-10 bg-slate-200 rounded-lg" />
                        ) : (
                          <select
                            value={entry.accountId}
                            onChange={(e) => handleEntryChange(index, 'accountId', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/50"
                            required
                          >
                            <option value="">Select an account</option>
                            {Object.entries(accountsByType).map(([type, accts]) => (
                              <optgroup key={type} label={type}>
                                {accts.map(account => {
                                  const code = (account.accountCode ?? account.code ?? '').toString().trim();
                                  const name = (account.accountName ?? account.name ?? '').toString().trim();
                                  const label = (code && name)
                                    ? `${code} - ${name}`
                                    : code || name || `Account ${(account.id || '').slice(-8)}`;
                                  return (
                                    <option key={account.id} value={account.id}>{label}</option>
                                  );
                                })}
                              </optgroup>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          placeholder="Line description (optional)"
                          value={entry.description}
                          onChange={(e) => handleEntryChange(index, 'description', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/50"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={entry.debit}
                          onChange={(e) => handleEntryChange(index, 'debit', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-right focus:ring-2 focus:ring-indigo-500/50 text-amber-700"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={entry.credit}
                          onChange={(e) => handleEntryChange(index, 'credit', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-right focus:ring-2 focus:ring-indigo-500/50 text-emerald-700"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeEntry(index)}
                          className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                          title="Remove line"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200 bg-slate-50/80 font-medium">
                    <td colSpan={2} className="px-4 py-3 text-right text-slate-700">Totals:</td>
                    <td className="px-4 py-3 text-right text-amber-700">{formatCurrency(totals.debit)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(totals.credit)}</td>
                    <td className="px-4 py-3" />
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td colSpan={3} className="px-4 py-3 text-right font-medium text-slate-700">Difference:</td>
                    <td className={`px-4 py-3 text-right font-medium ${totals.isBalanced ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {totals.isBalanced ? (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle size={16} />
                          Balanced
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <AlertCircle size={16} />
                          {formatCurrency(totals.difference)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleCancel}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || !totals.isBalanced || isPosted}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  {isEditing ? 'Updating...' : 'Saving...'}
                </>
              ) : (
                <>
                  <Save size={18} />
                  {isEditing ? 'Update Entry' : 'Save Entry'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JournalEntryForm;