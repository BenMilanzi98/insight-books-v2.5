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
  X
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
  
  // Fetch accounts for dropdown
  useEffect(() => {
    const fetchAccounts = async () => {
      setIsLoadingAccounts(true);
      try {
        const response = await fetch('/api/accounts');
        if (!response.ok) {
          throw new Error(`Error fetching accounts: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Ensure accounts have proper IDs
        const validAccounts = (data.accounts || []).filter(account => account.id);
        setAccounts(validAccounts);
        
        // Group accounts by type
        const groupedAccounts = validAccounts.reduce((groups, account) => {
          const type = account.type || 'Other';
          if (!groups[type]) {
            groups[type] = [];
          }
          groups[type].push(account);
          return groups;
        }, {});
        
        setAccountsByType(groupedAccounts);
        
        console.log('Fetched accounts:', validAccounts);
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
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center">
        <button
          onClick={handleCancel}
          className="mr-4 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold">
          {isEditing ? 'Edit Journal Entry' : 'New Journal Entry'}
        </h1>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 flex justify-between items-center">
          <div className="flex items-center">
            <AlertCircle className="mr-2" size={20} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-700">
            <X size={20} />
          </button>
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6 flex justify-between items-center">
          <div className="flex items-center">
            <CheckCircle className="mr-2" size={20} />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-green-700">
            <X size={20} />
          </button>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6">
        {isPosted && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            Posted entries are read-only. Corrections must be made via reversal or a new adjusting entry.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="date">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="border border-gray-300 p-2 w-full rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="entryType">
              Entry Type <span className="text-red-500">*</span>
            </label>
            <select
              id="entryType"
              name="entryType"
              value={formData.entryType}
              onChange={handleChange}
              className="border border-gray-300 p-2 w-full rounded"
              required
            >
              <option value="Correction">Correction</option>
              <option value="Accrual">Accrual</option>
              <option value="Opening Balance">Opening Balance</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="description">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="description"
              name="description"
              placeholder="Enter a description for this journal entry"
              value={formData.description}
              onChange={handleChange}
              className="border border-gray-300 p-2 w-full rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="internalReference">
              Internal Reference / Tag
            </label>
            <input
              type="text"
              id="internalReference"
              name="internalReference"
              placeholder="Optional internal reference or tag"
              value={formData.internalReference}
              onChange={handleChange}
              className="border border-gray-300 p-2 w-full rounded"
            />
          </div>
        </div>
        
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-medium">Entry Lines</h2>
            <button
              type="button"
              onClick={addEntry}
              className="bg-blue-100 text-blue-600 px-4 py-2 rounded hover:bg-blue-200 flex items-center gap-2"
            >
              <Plus size={16} />
              Add Line
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account <span className="text-red-500">*</span>
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="p-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Debit
                  </th>
                  <th className="p-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credit
                  </th>
                  <th className="p-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {formData.lines.map((entry, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="p-3">
                      {isLoadingAccounts ? (
                        <div className="animate-pulse h-10 bg-gray-200 rounded"></div>
                      ) : (
                        <select
                          value={entry.accountId}
                          onChange={(e) => handleEntryChange(index, 'accountId', e.target.value)}
                          className="border border-gray-300 p-2 w-full rounded"
                          required
                        >
                          <option value="">Select an account</option>
                          {/* Group accounts by type */}
                          {Object.entries(accountsByType).map(([type, accts]) => (
                            <optgroup key={type} label={type}>
                              {accts.map(account => (
                                <option key={account.id} value={account.id}>
                                  {account.code} - {account.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        placeholder="Line description (optional)"
                        value={entry.description}
                        onChange={(e) => handleEntryChange(index, 'description', e.target.value)}
                        className="border border-gray-300 p-2 w-full rounded"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={entry.debit}
                        onChange={(e) => handleEntryChange(index, 'debit', e.target.value)}
                        className="border border-gray-300 p-2 w-full rounded text-right"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={entry.credit}
                        onChange={(e) => handleEntryChange(index, 'credit', e.target.value)}
                        className="border border-gray-300 p-2 w-full rounded text-right"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeEntry(index)}
                        className="text-red-500 hover:text-red-700"
                        title="Remove line"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                
                {/* Totals row */}
                <tr className="border-t-2 border-gray-300 font-medium">
                  <td colSpan={2} className="p-3 text-right">
                    Totals:
                  </td>
                  <td className="p-3 text-right">
                    {formatCurrency(totals.debit)}
                  </td>
                  <td className="p-3 text-right">
                    {formatCurrency(totals.credit)}
                  </td>
                  <td className="p-3"></td>
                </tr>
                
                {/* Balance status row */}
                <tr>
                  <td colSpan={3} className="p-3 text-right font-medium">
                    Difference:
                  </td>
                  <td className={`p-3 text-right font-medium ${totals.isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                    {totals.isBalanced ? (
                      <span className="flex items-center justify-end">
                        <CheckCircle size={16} className="mr-1" />
                        Balanced
                      </span>
                    ) : (
                      <span className="flex items-center justify-end">
                        <AlertCircle size={16} className="mr-1" />
                        {formatCurrency(totals.difference)}
                      </span>
                    )}
                  </td>
                  <td className="p-3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="flex justify-end gap-4 mt-6">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
            disabled={isLoading || !totals.isBalanced || isPosted}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                {isEditing ? 'Updating...' : 'Saving...'}
              </>
            ) : (
              <>
                <Save size={16} />
                {isEditing ? 'Update Entry' : 'Save Entry'}
              </>
            )}
          </button>
        </div>
      </form>
      

    </div>
  );
};

export default JournalEntryForm;