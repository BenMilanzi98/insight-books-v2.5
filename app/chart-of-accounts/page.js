"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  GitMerge,
  BookOpen,
  ChevronsDownUp,
  ChevronsUpDown,
  Shield,
  Wallet,
  Landmark,
  Scale,
  TrendingUp,
  Receipt,
  Sparkles,
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
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSourceAccount, setMergeSourceAccount] = useState(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeAccounts, setMergeAccounts] = useState([]);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeError, setMergeError] = useState(null);
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
    Asset: ['Group', 'Current Asset', 'Non-current Asset', 'Non-Current Asset'],
    Liability: ['Group', 'Current Liability', 'Non-current Liability', 'Non-Current Liability'],
    Equity: ['Group', 'Equity', 'Capital'],
    Income: ['Group', 'Operating Income', 'Other Income'],
    Expense: ['Group', 'Cost of Sales', 'Operating Expense', 'Other Expense'],
  };

  const ROOT_CODES = new Set(['1000', '2000', '3000', '4000', '5000']);

  /** Accent per GL root — left stripe + icon tint (clean, not loud) */
  const ROOT_THEME = {
    '1000': {
      accent: 'border-l-[3px] border-l-emerald-500',
      rowBg: 'bg-emerald-50/50',
      iconWrap: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100',
      Icon: Wallet,
    },
    '2000': {
      accent: 'border-l-[3px] border-l-sky-500',
      rowBg: 'bg-sky-50/50',
      iconWrap: 'bg-sky-50 text-sky-900 ring-1 ring-sky-100',
      Icon: Landmark,
    },
    '3000': {
      accent: 'border-l-[3px] border-l-violet-500',
      rowBg: 'bg-violet-50/50',
      iconWrap: 'bg-violet-50 text-violet-900 ring-1 ring-violet-100',
      Icon: Scale,
    },
    '4000': {
      accent: 'border-l-[3px] border-l-amber-500',
      rowBg: 'bg-amber-50/40',
      iconWrap: 'bg-amber-50 text-amber-950 ring-1 ring-amber-100',
      Icon: TrendingUp,
    },
    '5000': {
      accent: 'border-l-[3px] border-l-rose-500',
      rowBg: 'bg-rose-50/50',
      iconWrap: 'bg-rose-50 text-rose-900 ring-1 ring-rose-100',
      Icon: Receipt,
    },
  };

  const typeBadgeClass = (t) => {
    const x = String(t || '').toLowerCase();
    if (x === 'asset') return 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/70';
    if (x === 'liability') return 'bg-sky-50 text-sky-900 ring-1 ring-sky-200/70';
    if (x === 'equity') return 'bg-violet-50 text-violet-900 ring-1 ring-violet-200/70';
    if (x === 'income' || x === 'revenue') return 'bg-amber-50 text-amber-950 ring-1 ring-amber-200/70';
    if (x === 'expense') return 'bg-rose-50 text-rose-900 ring-1 ring-rose-200/70';
    return 'bg-slate-100 text-slate-800 ring-1 ring-slate-200/80';
  };

  // Load accounts
  useEffect(() => {
    loadAccounts();
  }, [accountTypeFilter, activeFilter]);

  // Default-expand five main category roots and Capital parent (500000) for faster navigation
  useEffect(() => {
    if (!accounts.length) return;
    const rootCodes = ['1000', '2000', '3000', '4000', '5000'];
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      for (const a of accounts) {
        const c = a.accountCode || a.code;
        if (c && rootCodes.includes(c)) next.add(a.id);
      }
      const cap = accounts.find((a) => (a.accountCode || a.code) === '500000');
      if (cap?.id) next.add(cap.id);
      return next;
    });
  }, [accounts]);

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

  const loadMergeAccounts = async () => {
    const response = await fetch('/api/chart-of-accounts?includeInactive=true');
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to load accounts for merge');
    }
    const data = await response.json();
    setMergeAccounts(data.accounts || []);
  };

  const openMergeModal = async (sourceAccount) => {
    if (!sourceAccount) return;
    setMergeSourceAccount(sourceAccount);
    setMergeTargetId('');
    setMergeError(null);
    setShowMergeModal(true);
    try {
      await loadMergeAccounts();
    } catch (err) {
      setMergeError(err.message);
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

  const handleMergeAccounts = async () => {
    if (!mergeSourceAccount) return;
    if (!mergeTargetId) {
      setMergeError('Please select the target account.');
      return;
    }
    if (mergeTargetId === mergeSourceAccount.id) {
      setMergeError('Source and target accounts must be different.');
      return;
    }

    try {
      setMergeLoading(true);
      setMergeError(null);

      const response = await fetch('/api/chart-of-accounts/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceAccountId: mergeSourceAccount.id,
          targetAccountId: mergeTargetId
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to merge accounts');
      }

      setShowMergeModal(false);
      setMergeSourceAccount(null);
      setMergeTargetId('');
      setMergeAccounts([]);
      await loadAccounts();
    } catch (err) {
      setMergeError(err.message || 'Failed to merge accounts');
    } finally {
      setMergeLoading(false);
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

  /** Same pipeline as new-tenant setup: baseline CoA, default payment accounts, tax GL links, current month period */
  const handleInitializeBaseline = async () => {
    if (
      !confirm(
        'This will create or update everything that is normally set when a tenant is created: standard chart of accounts (codes and hierarchy), default payment accounts linked to the chart, default tax inflow/outflow accounts, and an open monthly period for the current month if missing. Existing account codes are updated in place. Continue?'
      )
    ) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/chart-of-accounts/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate standard accounts');
      }
      const parts = [
        data.message || 'Setup complete.',
        typeof data.accountCount === 'number' ? `GL accounts: ${data.accountCount}.` : null,
        typeof data.paymentAccountCount === 'number'
          ? `Payment methods: ${data.paymentAccountCount}.`
          : null,
      ].filter(Boolean);
      alert(parts.join(' '));
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

  const openViewModal = async (account) => {
    try {
      const response = await fetch(`/api/chart-of-accounts/${account.id}`);
      const data = await response.json();
      if (response.ok && data && !data.error) {
        // List endpoint includes rollup for parent accounts; detail GET is GL-only on that code.
        setSelectedAccount({
          ...data,
          postedDirectBalance:
            account.postedDirectBalance != null ? account.postedDirectBalance : data.postedDirectBalance,
          currentBalance:
            account.currentBalance != null ? account.currentBalance : data.currentBalance,
        });
      } else {
        setSelectedAccount(account);
      }
    } catch {
      setSelectedAccount(account);
    }
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

    const normCode = (c) =>
      String(c || '')
        .split(/-/)
        .map((p) => {
          const digits = p.replace(/\D/g, '');
          if (digits.length) return digits.padStart(8, '0');
          return p;
        })
        .join('.');

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

    const sortAccounts = (list) => {
      list.sort((a, b) => {
        const codeA = a.accountCode || a.code || '';
        const codeB = b.accountCode || b.code || '';
        return normCode(codeA).localeCompare(normCode(codeB), undefined, { numeric: true });
      });
      list.forEach((account) => {
        if (account.children && account.children.length > 0) {
          sortAccounts(account.children);
        }
      });
    };

    sortAccounts(rootAccounts);
    return rootAccounts;
  };

  const hierarchicalAccounts = useMemo(() => buildHierarchy(accounts), [accounts]);

  const collectAllIds = useCallback((node) => {
    const out = [node.id];
    for (const c of node.children || []) out.push(...collectAllIds(c));
    return out;
  }, []);

  const handleExpandAll = useCallback(() => {
    const ids = new Set();
    for (const root of hierarchicalAccounts) {
      for (const id of collectAllIds(root)) ids.add(id);
    }
    setExpandedAccounts(ids);
  }, [hierarchicalAccounts, collectAllIds]);

  const handleCollapseToRoots = useCallback(() => {
    const next = new Set();
    for (const a of accounts) {
      const c = a.accountCode || a.code;
      if (c && ROOT_CODES.has(c)) next.add(a.id);
    }
    const cap = accounts.find((a) => (a.accountCode || a.code) === '500000');
    if (cap?.id) next.add(cap.id);
    setExpandedAccounts(next);
  }, [accounts]);

  const renderAccountRow = (account, level = 0) => {
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expandedAccounts.has(account.id);
    const accountCode = account.accountCode || account.code || 'N/A';
    const accountName = account.accountName || account.name || 'Unnamed Account';
    const acctType = account.accountType || account.type || '';
    const isRoot = level === 0 && ROOT_CODES.has(String(accountCode));
    const isGroup =
      String(account.accountSubtype || '').toLowerCase() === 'group' ||
      (hasChildren && ['1000', '2000', '3000', '4000', '5000', '1100', '1120', '1500', '1900', '2100', '2500', '5100', '5200'].includes(String(accountCode)));

    const isLocked = account.isSystem || account.transactionCount > 0;
    const rootTheme = isRoot ? ROOT_THEME[String(accountCode)] : null;
    const showRollupHint =
      hasChildren &&
      account.postedDirectBalance != null &&
      Math.abs(Number(account.postedDirectBalance) - Number(account.currentBalance || 0)) > 0.005;
    const rollupBalanceTitle = showRollupHint
      ? `Posted on this account only: ${formatCurrency(account.postedDirectBalance)}. Total including all sub-accounts: ${formatCurrency(account.currentBalance || 0)}. Immediate sub-rows add up (with any amount on this code) to match the parent total.`
      : undefined;

    return (
      <React.Fragment key={account.id}>
        <tr
          className={[
            'group/row border-b border-slate-100/90 transition-colors duration-150',
            !account.isActive ? 'opacity-55' : '',
            isRoot && rootTheme
              ? `${rootTheme.accent} ${rootTheme.rowBg} hover:bg-white/80`
              : 'border-l-[3px] border-l-transparent bg-white hover:bg-slate-50/70',
          ].join(' ')}
        >
          <td className="px-4 py-3 align-middle sm:px-5 sm:py-3.5">
            <div
              className="flex items-center gap-2.5 min-w-0"
              style={{ paddingLeft: `${level * 18}px` }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleExpand(account.id)}
                  className="flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/40 hover:text-indigo-900 active:scale-[0.98]"
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? <ChevronDown size={16} strokeWidth={2.25} /> : <ChevronRight size={16} strokeWidth={2.25} />}
                </button>
              ) : (
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center" aria-hidden>
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                </span>
              )}
              <code
                className={[
                  'shrink-0 rounded-lg px-2.5 py-1 font-mono text-[12px] font-semibold tabular-nums tracking-tight',
                  isRoot
                    ? 'bg-white/90 text-slate-900 shadow-sm ring-1 ring-slate-300/50'
                    : 'bg-slate-100/95 text-slate-800 ring-1 ring-slate-200/50',
                ].join(' ')}
              >
                {accountCode}
              </code>
            </div>
          </td>
          <td className="px-4 py-3 align-middle sm:px-5 sm:py-3.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span
                className={[
                  'min-w-0 text-[13px] leading-snug text-slate-900',
                  isGroup || isRoot ? 'font-semibold tracking-tight' : 'font-medium text-slate-800',
                ].join(' ')}
              >
                {accountName}
              </span>
              {account.mergedIntoAccount ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-900 ring-1 ring-violet-100" title="System merge: row and code kept for audit; pickers use target">
                  → {account.mergedIntoAccount.accountCode}{' '}
                  {account.mergedIntoAccount.accountName || ''}
                </span>
              ) : null}
              {account.isSystem ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  <Shield size={10} strokeWidth={2.5} />
                  System
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 sm:hidden">
              <span
                className="font-mono text-xs tabular-nums font-medium text-slate-700"
                title={rollupBalanceTitle || undefined}
              >
                {formatCurrency(account.currentBalance || 0)}
              </span>
              {acctType ? (
                <span className={`text-[10px] font-medium capitalize ${typeBadgeClass(acctType)} rounded px-1.5 py-0`}>
                  {acctType}
                </span>
              ) : null}
            </div>
          </td>
          <td className="hidden px-4 py-3 align-middle sm:table-cell sm:px-5 sm:py-3.5">
            <span
              className={[
                'inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize',
                typeBadgeClass(acctType),
              ].join(' ')}
            >
              {acctType || '—'}
            </span>
          </td>
          <td
            className="hidden px-4 py-3 text-right align-middle font-mono text-[12px] font-semibold tabular-nums text-slate-800 sm:table-cell sm:px-5 sm:py-3.5 md:text-[13px]"
            title={rollupBalanceTitle || undefined}
          >
            {formatCurrency(account.currentBalance || 0)}
          </td>
          <td className="px-4 py-3 align-middle sm:px-5 sm:py-3.5">
            {account.isActive ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-100 sm:text-xs">
                <CheckCircle size={12} strokeWidth={2.5} className="text-emerald-600" />
                <span className="hidden sm:inline">Active</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200 sm:text-xs">
                <XCircle size={12} strokeWidth={2.5} />
                <span className="hidden sm:inline">Inactive</span>
              </span>
            )}
          </td>
          <td className="px-3 py-3 align-middle sm:px-5 sm:py-3.5">
            <div className="inline-flex items-center justify-end gap-0.5 rounded-xl border border-slate-200/80 bg-slate-50/90 p-0.5 shadow-sm sm:justify-start">
              <button
                type="button"
                onClick={() => openViewModal(account)}
                className="touch-manipulation rounded-md p-2.5 text-slate-500 transition-colors hover:bg-white hover:text-slate-900 sm:p-2"
                title="View details"
              >
                <Eye size={18} strokeWidth={2} className="sm:h-4 sm:w-4" />
              </button>
              <button
                type="button"
                onClick={() => !account.isSystem && openEditModal(account)}
                className={`touch-manipulation rounded-md p-2.5 transition-colors sm:p-2 ${account.isSystem ? 'cursor-not-allowed text-slate-200' : 'text-slate-500 hover:bg-white hover:text-slate-900'}`}
                title={account.isSystem ? 'System account (read-only)' : 'Edit'}
                disabled={account.isSystem}
              >
                <Edit size={18} strokeWidth={2} className="sm:h-4 sm:w-4" />
              </button>
              <button
                type="button"
                onClick={() => openMergeModal(account)}
                className="touch-manipulation rounded-md p-2.5 text-slate-500 transition-colors hover:bg-white hover:text-violet-700 sm:p-2"
                title={
                  account.isSystem
                    ? 'Merge this system account into another (same type/normal balance)'
                    : 'Merge into another account'
                }
              >
                <GitMerge size={18} strokeWidth={2} className="sm:h-4 sm:w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteAccount(account.id)}
                className={`touch-manipulation rounded-md p-2.5 transition-colors sm:p-2 ${isLocked ? 'cursor-not-allowed text-slate-200' : 'text-slate-500 hover:bg-white hover:text-rose-600'}`}
                title={isLocked ? 'Account in use or system account' : 'Delete or deactivate'}
                disabled={isLocked}
              >
                <Trash2 size={18} strokeWidth={2} className="sm:h-4 sm:w-4" />
              </button>
            </div>
          </td>
        </tr>
        {hasChildren && isExpanded && account.children.map((child) => renderAccountRow(child, level + 1))}
      </React.Fragment>
    );
  };

  const coaBtnSecondary =
    'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.99]';

  return (
    <PermissionGuard permission="accounts.view">
      <div className="relative min-h-screen overflow-hidden bg-slate-100">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_-15%,rgba(79,70,229,0.09),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(148,163,184,0.12),transparent_45%)]"
          aria-hidden
        />

        <div className="relative mx-auto max-w-[1680px] px-3 py-6 pb-20 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
          {/* Hero */}
          <header className="relative mb-8 overflow-hidden rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.12)] backdrop-blur-md ring-1 ring-slate-900/[0.04] sm:mb-10 sm:p-8 lg:p-10">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/50 to-transparent" />
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-indigo-500/[0.07] blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 left-1/4 h-48 w-48 rounded-full bg-slate-400/[0.06] blur-3xl" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex max-w-3xl gap-5 sm:gap-6">
                <div className="relative shrink-0">
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-600/10 blur-md" aria-hidden />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/25 ring-1 ring-white/20 sm:h-[4.25rem] sm:w-[4.25rem]">
                    <BookOpen className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.6} />
                  </div>
                </div>
                <div>
                  <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-indigo-600">
                    <Sparkles size={14} className="text-amber-500" strokeWidth={2} />
                    General ledger
                  </p>
                  <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-[2.35rem] sm:leading-[1.15]">
                    Chart of accounts
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                    Your live hierarchy from <span className="font-mono font-semibold text-slate-800">1000</span>–
                    <span className="font-mono font-semibold text-slate-800">5000</span>. Expand branches to audit codes,
                    balances, and protected system postings — all in one view.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 lg:items-end">
                <p className="hidden text-right text-[11px] font-medium uppercase tracking-wider text-slate-400 lg:block">
                  Actions
                </p>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button
                    type="button"
                    onClick={handleInitializeBaseline}
                    className={coaBtnSecondary}
                    title="Creates missing standard GL accounts, default payment accounts, and tax accounts (same as new-tenant setup)"
                  >
                    <CheckCircle size={17} strokeWidth={2} className="text-emerald-600" />
                    Sync CoA
                  </button>
                  <button type="button" onClick={() => handleImportTemplate('retail')} className={coaBtnSecondary}>
                    <Upload size={17} strokeWidth={2} />
                    Templates
                  </button>
                  <button type="button" onClick={() => handleExport('json')} className={coaBtnSecondary}>
                    <Download size={17} strokeWidth={2} />
                    Export
                  </button>
                  <label className={`${coaBtnSecondary} cursor-pointer`}>
                    <Upload size={17} strokeWidth={2} />
                    Import
                    <input type="file" accept=".json,.csv" onChange={handleImport} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setShowAddModal(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 active:scale-[0.99]"
                  >
                    <Plus size={18} strokeWidth={2.5} />
                    Add account
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Toolbar */}
          <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-white/90 p-4 shadow-sm backdrop-blur-sm ring-1 ring-slate-900/[0.03] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
            <div className="relative min-w-0 flex-1 max-w-xl">
              <Search
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 sm:left-4"
                strokeWidth={2}
              />
              <input
                type="search"
                placeholder="Filter by code, name, or description…"
                className="w-full rounded-xl border-0 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 ring-1 ring-slate-200/80 transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/25 sm:py-3 sm:pl-12 sm:pr-4"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={accountTypeFilter}
                onChange={(e) => setAccountTypeFilter(e.target.value)}
                className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:px-4"
              >
                <option value="All">All types</option>
                {accountTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:px-4">
                <input
                  type="checkbox"
                  checked={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
                />
                Active only
              </label>
              {!loading && hierarchicalAccounts.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleExpandAll}
                    className={coaBtnSecondary}
                    title="Expand all rows"
                  >
                    <ChevronsDownUp size={17} strokeWidth={2} />
                    Expand all
                  </button>
                  <button
                    type="button"
                    onClick={handleCollapseToRoots}
                    className={coaBtnSecondary}
                    title="Collapse to main categories"
                  >
                    <ChevronsUpDown size={17} strokeWidth={2} />
                    Main only
                  </button>
                </>
              )}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-4 rounded-2xl border border-rose-200/90 bg-rose-50/80 px-5 py-4 text-sm font-medium text-rose-950 shadow-sm backdrop-blur-sm"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 ring-1 ring-rose-200/60">
                <AlertCircle size={22} strokeWidth={2} />
              </span>
              <span className="pt-0.5">{error}</span>
            </div>
          )}

          <details className="group mb-8 overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 shadow-sm backdrop-blur-sm ring-1 ring-slate-900/[0.03] open:shadow-md">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50/80 sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-3.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-700 ring-1 ring-indigo-100/80">
                  <BookOpen size={18} strokeWidth={2} />
                </span>
                <span className="text-[15px] tracking-tight">Posting rules &amp; protected accounts</span>
              </span>
              <ChevronDown
                size={20}
                className="shrink-0 text-indigo-400 transition duration-300 group-open:rotate-180"
                strokeWidth={2}
              />
            </summary>
            <div className="border-t border-slate-100/90 bg-gradient-to-b from-slate-50/80 to-slate-50/40 px-5 py-5 sm:px-6 sm:py-6">
              <ul className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
                <li className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.02] sm:p-5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">System</span>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                    <strong className="font-semibold text-slate-800">System</strong> badges mark GL lines wired into
                    invoices, POS, bills, and tax — read-only in the grid.
                  </p>
                </li>
                <li className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.02] sm:p-5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600">Extend</span>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                    Add payment rails under{' '}
                    <code className="rounded-md bg-slate-900/[0.06] px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-800">
                      1120
                    </code>{' '}
                    as <code className="font-mono text-xs font-semibold text-slate-800">1130-xx</code>, or new expense
                    leaves under <code className="font-mono text-xs font-semibold text-slate-800">5000</code>.
                  </p>
                </li>
                <li className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.02] sm:p-5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600">Anchors</span>
                  <p className="mt-2.5 font-mono text-sm font-semibold leading-relaxed text-slate-700">
                    <span className="text-slate-900">1110</span> cash · <span className="text-slate-900">1200</span> AR ·{' '}
                    <span className="text-slate-900">2110</span> AP · <span className="text-slate-900">4100</span> sales
                  </p>
                </li>
              </ul>
            </div>
          </details>

          {/* Ledger table */}
          <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_4px_32px_-8px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04]">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-6 py-32">
                <div className="relative">
                  <div className="absolute inset-0 animate-ping rounded-full bg-indigo-400/15" />
                  <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-xl shadow-indigo-600/20 ring-1 ring-white/10">
                    <Loader2 size={32} className="animate-spin" strokeWidth={2} />
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-500">Loading chart of accounts…</p>
              </div>
            ) : hierarchicalAccounts.length === 0 ? (
              <div className="relative px-6 py-28 text-center">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(99,102,241,0.1),transparent_60%)]" />
                <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200/70 shadow-inner ring-1 ring-white/60">
                  <AlertCircle size={40} className="text-slate-400" strokeWidth={1.5} />
                </div>
                <h3 className="relative text-xl font-bold tracking-tight text-slate-900">No accounts yet</h3>
                <p className="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">
                  Sync the standard chart, import a template, or add accounts manually — your hierarchy will appear here.
                </p>
                <div className="relative mt-10 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleInitializeBaseline}
                    className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700"
                  >
                    Sync standard CoA
                  </button>
                  <button
                    type="button"
                    onClick={() => handleImportTemplate('retail')}
                    className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                  >
                    Import retail template
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm sm:min-w-full">
                  <thead>
                    <tr className="border-b border-slate-200/90 bg-slate-50/95 backdrop-blur-md">
                      <th className="sticky top-0 z-10 whitespace-nowrap px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:px-5">
                        Code
                      </th>
                      <th className="sticky top-0 z-10 whitespace-nowrap px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:px-5">
                        Account
                      </th>
                      <th className="sticky top-0 z-10 hidden whitespace-nowrap px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:table-cell sm:px-5">
                        Type
                      </th>
                      <th className="sticky top-0 z-10 hidden whitespace-nowrap px-4 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:table-cell sm:px-5">
                        Balance
                      </th>
                      <th className="sticky top-0 z-10 whitespace-nowrap px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:px-5">
                        Status
                      </th>
                      <th className="sticky top-0 z-10 whitespace-nowrap px-3 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:px-5">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  {hierarchicalAccounts.map((root, idx) => (
                    <tbody
                      key={root.id}
                      className={
                        idx === 0
                          ? ''
                          : 'border-t-2 border-slate-100 bg-gradient-to-b from-slate-50/40 to-white'
                      }
                    >
                      {renderAccountRow(root, 0)}
                    </tbody>
                  ))}
                </table>
              </div>
            )}
          </div>
        </div>
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

        {/* Merge Accounts Modal */}
        {showMergeModal && mergeSourceAccount && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
            onClick={() => {
              setShowMergeModal(false);
              setMergeSourceAccount(null);
              setMergeTargetId('');
              setMergeError(null);
            }}
          >
            <div
              className="max-h-[90vh] w-full max-w-2xl overflow-hidden overflow-y-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/15"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Merge accounts</h2>
                    <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-600">
                      References move to the target account; the source account is deactivated afterward.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMergeModal(false);
                      setMergeSourceAccount(null);
                      setMergeTargetId('');
                      setMergeError(null);
                    }}
                    className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close"
                  >
                    <X size={22} strokeWidth={2} />
                  </button>
                </div>
              </div>

              <div className="space-y-5 px-6 py-6">
                {mergeError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900"
                  >
                    {mergeError}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Source account
                    </label>
                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-4 ring-1 ring-slate-900/[0.02]">
                      <div className="font-semibold text-slate-900">
                        {mergeSourceAccount.accountCode || mergeSourceAccount.code || 'N/A'} —{' '}
                        {mergeSourceAccount.accountName || mergeSourceAccount.name || 'Unnamed Account'}
                      </div>
                      <div className="mt-1.5 text-sm text-slate-600">
                        Type {mergeSourceAccount.accountType || mergeSourceAccount.type || 'N/A'} · Normal{' '}
                        {mergeSourceAccount.normalBalance || 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Target account
                    </label>
                    <select
                      value={mergeTargetId}
                      onChange={(e) => setMergeTargetId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      disabled={mergeLoading}
                    >
                      <option value="">Select target…</option>
                      {mergeAccounts
                        .filter((a) => a && a.id !== mergeSourceAccount.id)
                        .map((a) => {
                          const code = a.accountCode || a.code || 'N/A';
                          const name = a.accountName || a.name || 'Unnamed Account';
                          const type = a.accountType || a.type || 'N/A';
                          const isActive = a.isActive ? 'Active' : 'Inactive';
                          return (
                            <option key={a.id} value={a.id}>
                              {code} — {name} ({type}, {isActive})
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm leading-relaxed text-amber-950">
                    Prefer the same account type and normal balance (required by the server). Choose the account you want
                    pickers and reports to use going forward.
                  </div>

                  <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMergeModal(false);
                        setMergeSourceAccount(null);
                        setMergeTargetId('');
                        setMergeError(null);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                      disabled={mergeLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleMergeAccounts}
                      className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={mergeLoading || !mergeTargetId}
                    >
                      {mergeLoading ? 'Merging…' : 'Merge accounts'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
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

  const field =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';
  const label = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/15"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X size={22} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900"
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className={label}>
                Account code <span className="font-normal normal-case text-slate-400">(required, numeric)</span>
              </label>
              <input
                type="text"
                value={formData.accountCode}
                onChange={(e) => setFormData({ ...formData, accountCode: e.target.value })}
                className={field}
                placeholder="e.g. 1010"
                disabled={isEdit && (account?.transactionCount > 0 || account?.isSystem)}
              />
            </div>

            <div>
              <label className={label}>Account name</label>
              <input
                type="text"
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                className={field}
                placeholder="e.g. Cash on hand"
                disabled={isEdit && (account?.transactionCount > 0 || account?.isSystem)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className={label}>Account type</label>
              <select
                value={formData.accountType}
                onChange={(e) => setFormData({ ...formData, accountType: e.target.value, accountSubtype: '' })}
                className={field}
                disabled={isEdit && (account?.transactionCount > 0 || account?.isSystem)}
              >
                {accountTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={label}>Sub-type</label>
              <select
                value={formData.accountSubtype}
                onChange={(e) => setFormData({ ...formData, accountSubtype: e.target.value })}
                className={field}
                disabled={!accountSubtypes[formData.accountType] || accountSubtypes[formData.accountType].length === 0}
              >
                <option value="">None</option>
                {accountSubtypes[formData.accountType]?.map((subtype) => (
                  <option key={subtype} value={subtype}>
                    {subtype}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className={label}>Normal balance</label>
              <div className="mt-2 flex flex-wrap items-center gap-6">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="radio"
                    value="Debit"
                    checked={formData.normalBalance === 'Debit'}
                    onChange={(e) => setFormData({ ...formData, normalBalance: e.target.value })}
                    className="border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
                    disabled={isEdit && (account?.transactionCount > 0 || account?.isSystem)}
                  />
                  Debit
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="radio"
                    value="Credit"
                    checked={formData.normalBalance === 'Credit'}
                    onChange={(e) => setFormData({ ...formData, normalBalance: e.target.value })}
                    className="border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
                    disabled={isEdit && (account?.transactionCount > 0 || account?.isSystem)}
                  />
                  Credit
                </label>
              </div>
            </div>

            <div>
              <label className={label}>
                Parent <span className="font-normal normal-case text-slate-400">(optional)</span>
              </label>
              <select
                value={formData.parentAccountId}
                onChange={(e) => setFormData({ ...formData, parentAccountId: e.target.value })}
                className={field}
              >
                <option value="">None (top level)</option>
                {accounts
                  .filter((a) => (a.accountType || a.type) === formData.accountType && a.id !== account?.id)
                  .map((acc) => {
                    const code = acc.accountCode || acc.code || 'N/A';
                    const name = acc.accountName || acc.name || 'Unnamed';
                    return (
                      <option key={acc.id} value={acc.id}>
                        {code} — {name}
                      </option>
                    );
                  })}
              </select>
            </div>
          </div>

          <div>
            <label className={label}>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className={`${field} min-h-[5.5rem] resize-y`}
              rows={3}
              placeholder="What this account is used for…"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200/90 bg-slate-50/50 px-4 py-3">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
            />
            <span className="text-sm font-medium text-slate-800">Account is active</span>
          </label>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700"
          >
            {isEdit ? 'Save changes' : 'Create account'}
          </button>
        </div>
      </div>
    </div>
  );
};

// View Account Modal Component
const ViewAccountModal = ({ account, onClose }) => {
  const dl = 'text-xs font-semibold uppercase tracking-wider text-slate-500';
  const card = 'rounded-xl border border-slate-200/90 bg-slate-50/40 p-4 ring-1 ring-slate-900/[0.02]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/15"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Account details</h2>
              <p className="mt-1 font-mono text-sm font-semibold text-indigo-600">
                {account.accountCode || account.code || 'N/A'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X size={22} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className={card}>
            <p className={dl}>Name</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {account.accountName || account.name || 'Unnamed account'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={card}>
              <p className={dl}>Type</p>
              <p className="mt-1 font-medium capitalize text-slate-900">{account.accountType || account.type || '—'}</p>
            </div>
            <div className={card}>
              <p className={dl}>Sub-type</p>
              <p className="mt-1 font-medium text-slate-900">{account.accountSubtype || '—'}</p>
            </div>
            <div className={card}>
              <p className={dl}>Normal balance</p>
              <p className="mt-1 font-medium text-slate-900">{account.normalBalance || '—'}</p>
            </div>
            <div className={card}>
              <p className={dl}>Current balance</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">
                {formatCurrency(account.currentBalance || 0)}
              </p>
              {account.postedDirectBalance != null &&
                Math.abs(Number(account.postedDirectBalance) - Number(account.currentBalance || 0)) > 0.005 && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    Posted on this code only: {formatCurrency(account.postedDirectBalance)}. Total includes
                    sub-accounts on this row.
                  </p>
                )}
            </div>
          </div>

          {account.parentAccount && (
            <div className={card}>
              <p className={dl}>Parent</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {account.parentAccount.accountCode || account.parentAccount.code || 'N/A'} —{' '}
                {account.parentAccount.accountName || account.parentAccount.name || 'Unnamed'}
              </p>
            </div>
          )}

          {account.childAccounts && account.childAccounts.length > 0 && (
            <div className={card}>
              <p className={dl}>Child accounts</p>
              <ul className="mt-2 space-y-2 border-t border-slate-200/60 pt-3">
                {account.childAccounts.map((child) => {
                  const code = child.accountCode || child.code || 'N/A';
                  const name = child.accountName || child.name || 'Unnamed';
                  return (
                    <li key={child.id} className="flex justify-between gap-3 text-sm text-slate-800">
                      <span className="font-mono font-semibold tabular-nums text-indigo-700">{code}</span>
                      <span className="min-w-0 text-right text-slate-700">{name}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {account.description && (
            <div className={card}>
              <p className={dl}>Description</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">{account.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={card}>
              <p className={dl}>Status</p>
              <p className="mt-1">
                {account.isActive ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                    <CheckCircle size={18} strokeWidth={2} className="text-emerald-600" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                    <XCircle size={18} strokeWidth={2} />
                    Inactive
                  </span>
                )}
              </p>
            </div>
            <div className={card}>
              <p className={dl}>Transactions</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">
                {account.transactionCount || 0}
                <span className="ml-2 text-sm font-normal text-slate-600">posted</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChartOfAccountsPage;
