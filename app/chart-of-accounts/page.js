"use client";
import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye, 
  Download, 
  Upload,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  X,
  BookOpen
} from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';
import PermissionGuard from '@/components/PermissionGuard';

const ChartOfAccountsPage = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('All');
  const [activeFilter, setActiveFilter] = useState(true);
  const [expandedAccounts, setExpandedAccounts] = useState(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [formData, setFormData] = useState({
    accountCode: '',
    accountName: '',
    accountType: 'Asset',
    accountSubtype: '',
    normalBalance: 'Debit',
    parentAccountId: '',
    description: '',
    isActive: true
  });

  // Account type options
  const accountTypes = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];
  
  // Subtype options by account type
  const accountSubtypes = {
    'Asset': ['Current Asset', 'Non-Current Asset'],
    'Liability': ['Current Liability', 'Non-Current Liability'],
    'Equity': [],
    'Income': ['Operating Income', 'Other Income'],
    'Expense': ['Cost of Sales', 'Operating Expense', 'Other Expense']
  };

  // Load accounts
  useEffect(() => {
    loadAccounts();
  }, [accountTypeFilter, activeFilter]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (accountTypeFilter !== 'All') {
        params.append('accountType', accountTypeFilter);
      }
      params.append('isActive', activeFilter.toString());
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await fetch(`/api/chart-of-accounts?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to load accounts');
      }

      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error('Error loading accounts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadAccounts();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddAccount = async () => {
    try {
      setError(null);

      const response = await fetch('/api/chart-of-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      setShowAddModal(false);
      resetForm();
      loadAccounts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateAccount = async () => {
    try {
      setError(null);

      const response = await fetch(`/api/chart-of-accounts/${selectedAccount.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update account');
      }

      setShowEditModal(false);
      setSelectedAccount(null);
      resetForm();
      loadAccounts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteAccount = async (accountId) => {
    if (!confirm('Are you sure you want to delete this account? Accounts with transactions will be deactivated instead.')) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`/api/chart-of-accounts/${accountId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account');
      }

      loadAccounts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleImportTemplate = async (templateId = 'retail') => {
    if (!confirm(`This will import the ${templateId} Chart of Accounts template. Existing accounts will be skipped unless overwrite is enabled. Continue?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/accounts/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, overwrite: false })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import template');
      }

      alert(`Successfully imported template! Created: ${data.results.created}, Skipped: ${data.results.skipped}`);
      loadAccounts();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format = 'json') => {
    try {
      setLoading(true);
      const response = await fetch(`/api/accounts/export?format=${format}`);
      
      if (!response.ok) {
        throw new Error('Failed to export accounts');
      }

      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `accounts-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `accounts-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      setError(null);

      const text = await file.text();
      let accountsData;

      if (file.name.endsWith('.json')) {
        accountsData = JSON.parse(text);
        accountsData = accountsData.accounts || accountsData;
      } else if (file.name.endsWith('.csv')) {
        // Simple CSV parsing (you might want to use a library for production)
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        accountsData = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = values[index] || '';
          });
          return obj;
        });
      } else {
        throw new Error('Unsupported file format. Please use JSON or CSV.');
      }

      if (!Array.isArray(accountsData)) {
        throw new Error('Invalid file format. Expected an array of accounts.');
      }

      const response = await fetch('/api/accounts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: accountsData, overwrite: false, skipDuplicates: true })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import accounts');
      }

      alert(`Import completed! Created: ${data.results.created}, Updated: ${data.results.updated}, Skipped: ${data.results.skipped}`);
      loadAccounts();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      event.target.value = ''; // Reset file input
    }
  };

  const resetForm = () => {
    setFormData({
      accountCode: '',
      accountName: '',
      accountType: 'Asset',
      accountSubtype: '',
      normalBalance: 'Debit',
      parentAccountId: '',
      description: '',
      isActive: true
    });
  };

  const openEditModal = (account) => {
    setSelectedAccount(account);
    setFormData({
      accountCode: account.accountCode || account.code || '',
      accountName: account.accountName || account.name || '',
      accountType: account.accountType || account.type || '',
      accountSubtype: account.accountSubtype || '',
      normalBalance: account.normalBalance || '',
      parentAccountId: account.parentAccountId || '',
      description: account.description || '',
      isActive: account.isActive
    });
    setShowEditModal(true);
  };

  const openViewModal = (account) => {
    setSelectedAccount(account);
    setShowViewModal(true);
  };

  const toggleExpand = (accountId) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedAccounts(newExpanded);
  };

  // Build hierarchical structure
  const buildHierarchy = (accounts) => {
    const accountMap = new Map();
    const rootAccounts = [];

    // Create map
    accounts.forEach(account => {
      accountMap.set(account.id, { ...account, children: [] });
    });

    // Build tree
    accounts.forEach(account => {
      const accountNode = accountMap.get(account.id);
      if (account.parentAccountId) {
        const parent = accountMap.get(account.parentAccountId);
        if (parent) {
          parent.children.push(accountNode);
        } else {
          rootAccounts.push(accountNode);
        }
      } else {
        rootAccounts.push(accountNode);
      }
    });

    // Sort by account code
    const sortAccounts = (accounts) => {
      accounts.sort((a, b) => {
        const codeA = a.accountCode || a.code || '';
        const codeB = b.accountCode || b.code || '';
        return codeA.localeCompare(codeB);
      });
      accounts.forEach(account => {
        if (account.children && account.children.length > 0) {
          sortAccounts(account.children);
        }
      });
    };

    sortAccounts(rootAccounts);
    return rootAccounts;
  };

  const renderAccountRow = (account, level = 0) => {
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expandedAccounts.has(account.id);
    const indent = level * 24;
    const accountCode = account.accountCode || account.code || 'N/A';
    const accountName = account.accountName || account.name || 'Unnamed Account';

    const isLocked = account.isSystem || account.transactionCount > 0;
    return (
      <React.Fragment key={account.id}>
        <tr className={`hover:bg-indigo-50/30 transition-colors ${!account.isActive ? 'opacity-60' : ''}`}>
          <td className="px-5 py-3 text-sm">
            <div className="flex items-center" style={{ paddingLeft: `${indent}px` }}>
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(account.id)}
                  className="mr-2 text-slate-400 hover:text-indigo-600"
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              ) : (
                <span className="w-6 mr-2"></span>
              )}
              <span className="font-medium text-gray-900">{accountCode}</span>
            </div>
          </td>
          <td className="px-5 py-3 text-sm text-gray-900">
            {level > 0 && <span className="text-gray-400 mr-2">└─</span>}
            {accountName}
          </td>
          <td className="px-5 py-3 text-sm text-gray-700">{account.accountType || account.type || 'N/A'}</td>
          <td className="px-5 py-3 text-sm text-gray-700 text-right font-medium">
            {formatCurrency(account.currentBalance || 0)}
          </td>
          <td className="px-5 py-3 text-sm">
            {account.isActive ? (
              <span className="inline-flex items-center text-green-600">
                <CheckCircle size={14} className="mr-1" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center text-gray-400">
                <XCircle size={14} className="mr-1" />
                Inactive
              </span>
            )}
          </td>
          <td className="px-5 py-3 text-sm">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => openViewModal(account)}
                className="text-blue-600 hover:text-blue-800 transition-colors"
                title="View Details"
              >
                <Eye size={16} />
              </button>
              <button
                onClick={() => !account.isSystem && openEditModal(account)}
                className={`transition-colors ${account.isSystem ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-gray-800'}`}
                title={account.isSystem ? 'System account (read-only)' : 'Edit'}
                disabled={account.isSystem}
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => handleDeleteAccount(account.id)}
                className={`transition-colors ${isLocked ? 'text-gray-300 cursor-not-allowed' : 'text-red-600 hover:text-red-800'}`}
                title={isLocked ? 'Account in use or system account' : 'Delete'}
                disabled={isLocked}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </td>
        </tr>
        {hasChildren && isExpanded && account.children.map(child => renderAccountRow(child, level + 1))}
      </React.Fragment>
    );
  };

  const hierarchicalAccounts = buildHierarchy(accounts);

  return (
    <PermissionGuard permission="accounts.view">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
        <div className="container mx-auto px-4 sm:px-6 py-6 lg:py-8 max-w-7xl pb-12">
          {/* Header */}
          <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 shadow-xl shadow-indigo-200/50 p-6 sm:p-8 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                  <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Chart of Accounts</h1>
                  <p className="text-indigo-100 text-sm mt-0.5">Manage your accounting accounts and structure</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleImportTemplate('retail')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium border border-white/20 transition-colors"
                  title="Import Retail Template"
                >
                  <Upload size={18} />
                  Templates
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('json')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium border border-white/20 transition-colors"
                  title="Export as JSON"
                >
                  <Download size={18} />
                  Export
                </button>
                <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium border border-white/20 cursor-pointer transition-colors">
                  <Upload size={18} />
                  Import
                  <input type="file" accept=".json,.csv" onChange={handleImport} className="hidden" />
                </label>
                <button
                  type="button"
                  onClick={() => { resetForm(); setShowAddModal(true); }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-600 hover:bg-indigo-50 font-semibold shadow-lg transition-colors"
                >
                  <Plus size={18} />
                  Add Account
                </button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-100 p-4 sm:p-6 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by code, name, or description..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 focus:bg-white transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <select
                value={accountTypeFilter}
                onChange={(e) => setAccountTypeFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
              >
                <option value="All">All Types</option>
                {accountTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                <input type="checkbox" checked={activeFilter} onChange={(e) => setActiveFilter(e.target.checked)} className="rounded text-indigo-600" />
                <span className="text-sm font-medium text-slate-700">Active only</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 flex items-center gap-2 shadow-sm">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {/* Accounts Table */}
          <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 size={40} className="animate-spin text-indigo-600 mb-4" />
                <p className="text-slate-500 font-medium">Loading accounts...</p>
              </div>
            ) : hierarchicalAccounts.length === 0 ? (
              <div className="py-20 text-center px-4">
                <div className="p-4 rounded-2xl bg-slate-100 inline-block mb-4">
                  <AlertCircle size={48} className="text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">No accounts found</h3>
                <p className="text-slate-500 mb-6">Import the standard template or create your first account.</p>
                <button
                  type="button"
                  onClick={() => handleImportTemplate('retail')}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Import standard template
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200">
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Code</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Account name</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                      <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Balance</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {hierarchicalAccounts.map(account => renderAccountRow(account))}
                  </tbody>
                </table>
            </div>
          )}
        </div>

        {/* Add Account Modal */}
        {showAddModal && (
          <AccountModal
            title="Add New Account"
            formData={formData}
            setFormData={setFormData}
            accountTypes={accountTypes}
            accountSubtypes={accountSubtypes}
            accounts={accounts}
            onSave={handleAddAccount}
            onCancel={() => {
              setShowAddModal(false);
              resetForm();
            }}
            error={error}
          />
        )}

        {/* Edit Account Modal */}
        {showEditModal && selectedAccount && (
          <AccountModal
            title="Edit Account"
            formData={formData}
            setFormData={setFormData}
            accountTypes={accountTypes}
            accountSubtypes={accountSubtypes}
            accounts={accounts.filter(a => a.id !== selectedAccount.id)}
            onSave={handleUpdateAccount}
            onCancel={() => {
              setShowEditModal(false);
              setSelectedAccount(null);
              resetForm();
            }}
            error={error}
            isEdit={true}
            account={selectedAccount}
          />
        )}

        {/* View Account Modal */}
        {showViewModal && selectedAccount && (
          <ViewAccountModal
            account={selectedAccount}
            onClose={() => {
              setShowViewModal(false);
              setSelectedAccount(null);
            }}
          />
        )}
        </div>
      </div>
    </PermissionGuard>
  );
};

// Account Form Modal Component
const AccountModal = ({ 
  title, 
  formData, 
  setFormData, 
  accountTypes, 
  accountSubtypes, 
  accounts,
  onSave, 
  onCancel, 
  error,
  isEdit = false,
  account = null
}) => {
  // Auto-set normal balance based on account type
  useEffect(() => {
    const normalBalanceMap = {
      'Asset': 'Debit',
      'Expense': 'Debit',
      'Liability': 'Credit',
      'Equity': 'Credit',
      'Income': 'Credit'
    };

    if (!isEdit && formData.accountType) {
      setFormData(prev => ({
        ...prev,
        normalBalance: normalBalanceMap[formData.accountType] || 'Debit'
      }));
    }
  }, [formData.accountType, isEdit]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-lg border border-gray-300 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 bg-gray-50/50">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">{title}</h2>
            <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 border border-red-300 bg-red-50 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Code * <span className="text-xs text-gray-500">(numeric only)</span>
              </label>
              <input
                type="text"
                value={formData.accountCode}
                onChange={(e) => setFormData({ ...formData, accountCode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 1010"
                disabled={isEdit && (account?.transactionCount > 0 || account?.isSystem)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Name *
              </label>
              <input
                type="text"
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Cash on Hand"
                disabled={isEdit && (account?.transactionCount > 0 || account?.isSystem)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Type *
              </label>
              <select
                value={formData.accountType}
                onChange={(e) => setFormData({ ...formData, accountType: e.target.value, accountSubtype: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isEdit && (account?.transactionCount > 0 || account?.isSystem)}
              >
                {accountTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sub-Type
              </label>
              <select
                value={formData.accountSubtype}
                onChange={(e) => setFormData({ ...formData, accountSubtype: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={!accountSubtypes[formData.accountType] || accountSubtypes[formData.accountType].length === 0}
              >
                <option value="">None</option>
                {accountSubtypes[formData.accountType]?.map(subtype => (
                  <option key={subtype} value={subtype}>{subtype}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Normal Balance *
              </label>
              <div className="flex items-center space-x-4 mt-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="Debit"
                    checked={formData.normalBalance === 'Debit'}
                    onChange={(e) => setFormData({ ...formData, normalBalance: e.target.value })}
                    className="mr-2"
                    disabled={isEdit && (account?.transactionCount > 0 || account?.isSystem)}
                  />
                  <span>Debit</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="Credit"
                    checked={formData.normalBalance === 'Credit'}
                    onChange={(e) => setFormData({ ...formData, normalBalance: e.target.value })}
                    className="mr-2"
                    disabled={isEdit && (account?.transactionCount > 0 || account?.isSystem)}
                  />
                  <span>Credit</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parent Account <span className="text-xs text-gray-500">(optional)</span>
              </label>
              <select
                value={formData.parentAccountId}
                onChange={(e) => setFormData({ ...formData, parentAccountId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">None (Top Level)</option>
                {accounts
                  .filter(a => (a.accountType || a.type) === formData.accountType && a.id !== account?.id)
                  .map(acc => {
                    const code = acc.accountCode || acc.code || 'N/A';
                    const name = acc.accountName || acc.name || 'Unnamed';
                    return (
                      <option key={acc.id} value={acc.id}>
                        {code} - {name}
                      </option>
                    );
                  })}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="What this account is used for..."
            />
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50/50 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 bg-white rounded-md hover:bg-gray-50 text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {isEdit ? 'Update Account' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

// View Account Modal Component
const ViewAccountModal = ({ account, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg border border-gray-300 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 bg-gray-50/50">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Account Details</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Account Code</label>
              <p className="text-base font-semibold text-gray-900">{account.accountCode || account.code || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Account Name</label>
              <p className="text-base font-semibold text-gray-900">{account.accountName || account.name || 'Unnamed Account'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Account Type</label>
              <p className="text-base text-gray-900">{account.accountType || account.type || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Sub-Type</label>
              <p className="text-base text-gray-900">{account.accountSubtype || 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Normal Balance</label>
              <p className="text-base text-gray-900">{account.normalBalance || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Current Balance</label>
              <p className="text-base font-semibold text-gray-900">
                {formatCurrency(account.currentBalance || 0)}
              </p>
            </div>
          </div>

          {account.parentAccount && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Parent Account</label>
              <p className="text-base text-gray-900">
                {account.parentAccount.accountCode || account.parentAccount.code || 'N/A'} - {account.parentAccount.accountName || account.parentAccount.name || 'Unnamed'}
              </p>
            </div>
          )}

          {account.childAccounts && account.childAccounts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Child Accounts</label>
              <ul className="list-disc list-inside space-y-1">
                {account.childAccounts.map(child => {
                  const code = child.accountCode || child.code || 'N/A';
                  const name = child.accountName || child.name || 'Unnamed';
                  return (
                    <li key={child.id} className="text-base text-gray-900">
                      {code} - {name}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {account.description && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Description</label>
              <p className="text-base text-gray-900">{account.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
              <p className="text-base text-gray-900">
                {account.isActive ? (
                  <span className="inline-flex items-center text-green-600">
                    <CheckCircle size={16} className="mr-1" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center text-gray-400">
                    <XCircle size={16} className="mr-1" />
                    Inactive
                  </span>
                )}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Transactions</label>
              <p className="text-base text-gray-900">{account.transactionCount || 0} posted entries</p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChartOfAccountsPage;
