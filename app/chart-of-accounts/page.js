"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Plus,
  Search,
  Download,
  Upload,
  ChevronDown,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';
import PermissionGuard from '@/components/PermissionGuard';
import PhinduLedgerCoaTable from '@/components/chart-of-accounts/PhinduLedgerCoaTable';

const ChartOfAccountsPage = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('All');
  const [activeFilter, setActiveFilter] = useState(true);
  /** Include merged sources + chart-hidden (retired) rows for audit. */
  const [auditMode, setAuditMode] = useState(false);
  /** API returns blueprint + 1130-xx / 3101–3199 only. */
  const [canonicalSurface, setCanonicalSurface] = useState(false);
  /** Cancels stale chart fetches so overlapping requests cannot apply results out of order. */
  const chartFetchAbortRef = useRef(null);
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

  const loadAccounts = useCallback(async () => {
    chartFetchAbortRef.current?.abort();
    const ac = new AbortController();
    chartFetchAbortRef.current = ac;
    const { signal } = ac;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (accountTypeFilter !== 'All') {
        params.append('accountType', accountTypeFilter);
      }
      params.append('isActive', activeFilter.toString());
      const trimmedSearch = searchQuery.trim();
      if (trimmedSearch) {
        params.append('search', trimmedSearch);
      }
      if (auditMode) {
        params.append('includeChartHidden', 'true');
        params.append('includeMergedSources', 'true');
      }
      if (canonicalSurface) {
        params.append('canonicalSurface', 'true');
      }

      const response = await fetch(`/api/chart-of-accounts?${params.toString()}`, {
        signal,
        cache: 'no-store',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error('Failed to load accounts');
      }

      const data = await response.json();
      if (signal.aborted) return;
      setAccounts(data.accounts || []);
    } catch (err) {
      if (err?.name === 'AbortError' || signal.aborted) return;
      console.error('Error loading accounts:', err);
      setError(err.message);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [accountTypeFilter, activeFilter, auditMode, canonicalSurface, searchQuery]);

  // Single schedule: no duplicate mount fetch (previously a second effect debounced empty search and raced).
  useEffect(() => {
    const delay = searchQuery.trim() ? 300 : 0;
    const timer = setTimeout(() => {
      void loadAccounts();
    }, delay);
    return () => {
      clearTimeout(timer);
      chartFetchAbortRef.current?.abort();
    };
  }, [loadAccounts]);

  const loadMergeAccounts = async () => {
    const response = await fetch('/api/chart-of-accounts?includeInactive=true', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
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
      await loadAccounts();
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
      await loadAccounts();
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

      await loadAccounts();
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
      await loadAccounts();
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
      await loadAccounts();
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
      await loadAccounts();
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
        // Chart grid may roll up children on parents; API returns row-level breakdown in balanceSources.
        setSelectedAccount({
          ...data,
          chartGridBalance:
            account.currentBalance != null ? Number(account.currentBalance) : Number(data.currentBalance),
          rowOnlyTotalFromApi: Number(data.currentBalance),
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
                    The main tree matches the standard PHINDU structure (same for every tenant). Your existing GL
                    codes attach by <span className="font-mono font-semibold text-slate-800">accountCode</span>; extras
                    appear in the dropdowns on Bank - Primary (1130), Owner's Capital (3100), and the range
                    catch-all lines.
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
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-violet-200/90 bg-violet-50/50 px-3 py-2.5 text-sm font-medium text-violet-900 shadow-sm transition hover:bg-violet-50 sm:px-4">
                <input
                  type="checkbox"
                  checked={auditMode}
                  onChange={(e) => setAuditMode(e.target.checked)}
                  className="rounded border-violet-300 text-violet-600 focus:ring-violet-500/30"
                />
                Audit mode
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:px-4">
                <input
                  type="checkbox"
                  checked={canonicalSurface}
                  onChange={(e) => setCanonicalSurface(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
                />
                Canonical surface
              </label>
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
                      1130
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

          <PhinduLedgerCoaTable
            loading={loading}
            accounts={accounts}
            activeFilter={activeFilter}
            auditMode={auditMode}
            onViewAccount={openViewModal}
            onEditAccount={openEditModal}
            onMergeAccount={openMergeModal}
            onDeleteAccount={handleDeleteAccount}
            emptyStateExtra={
              <>
                <button
                  type="button"
                  onClick={handleInitializeBaseline}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  Sync standard CoA
                </button>
                <button
                  type="button"
                  onClick={() => handleImportTemplate('retail')}
                  className="rounded-lg border border-amber-300/80 bg-white px-4 py-2 text-xs font-semibold text-amber-950 shadow-sm transition hover:bg-amber-50/80"
                >
                  Import retail template
                </button>
              </>
            }
          />
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
              <p className={dl}>Current balance (chart)</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">
                {formatCurrency(
                  account.chartGridBalance != null ? account.chartGridBalance : account.currentBalance || 0
                )}
              </p>
              {account.balanceSources &&
                Math.abs(
                  Number(account.chartGridBalance ?? account.currentBalance) -
                    Number(account.balanceSources.displayedRowTotal)
                ) > 0.005 && (
                  <p className="mt-2 text-xs leading-relaxed text-amber-800">
                    This code alone (no child rollup):{' '}
                    <span className="font-mono font-semibold">
                      {formatCurrency(account.balanceSources.displayedRowTotal)}
                    </span>
                    . The chart total above includes rolled-up sub-accounts when this row is a parent.
                  </p>
                )}
              {account.postedDirectBalance != null &&
                Math.abs(Number(account.postedDirectBalance) - Number(account.currentBalance || 0)) > 0.005 && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    Posted on this code only: {formatCurrency(account.postedDirectBalance)}. Total includes
                    sub-accounts on this row.
                  </p>
                )}
            </div>
          </div>

          {account.balanceSources && (
            <div className={card}>
              <p className={dl}>Balance composition</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Source: <span className="font-mono text-slate-800">{account.balanceSources.balanceSource}</span>
                {account.balanceSources.mergeRollupPostingAccountCount > 1 && (
                  <>
                    {' '}
                    · CoA merge rollup:{' '}
                    <span className="font-mono">{account.balanceSources.mergeRollupPostingAccountCount}</span>{' '}
                    account ids post into this code
                  </>
                )}
              </p>
              {account.balanceSources.reconciliationHint && (
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  {account.balanceSources.reconciliationHint}
                </p>
              )}
              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200/80">
                <table className="min-w-full text-left text-sm text-slate-800">
                  <thead className="bg-slate-100/80 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Credit</th>
                      <th className="px-3 py-2 text-right">Net / amount</th>
                      <th className="px-3 py-2 text-right">Accumulated</th>
                      <th className="px-3 py-2 text-right">Running total</th>
                      <th className="px-3 py-2 text-right">Lines</th>
                    </tr>
                  </thead>
                  <tbody>
                    {account.balanceSources.components.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium text-slate-900">{row.label}</div>
                          {row.note && (
                            <div className="mt-0.5 text-xs font-normal text-slate-500">{row.note}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {row.debit != null ? formatCurrency(row.debit) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {row.credit != null ? formatCurrency(row.credit) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">
                          {row.netEffect != null
                            ? formatCurrency(row.netEffect)
                            : row.amount != null
                              ? formatCurrency(row.amount)
                              : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-900">
                          {row.accumulatedAmount != null ? formatCurrency(row.accumulatedAmount) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-indigo-900">
                          {row.runningTotalAfterThisSource != null
                            ? formatCurrency(row.runningTotalAfterThisSource)
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {row.lineCount != null ? row.lineCount : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Displayed row total:{' '}
                <span className="font-mono font-semibold text-slate-800">
                  {formatCurrency(account.balanceSources.displayedRowTotal)}
                </span>
                {account.balanceSources.components.length > 0 && (
                  <>
                    {' '}
                    (last running total should match, for the active source row)
                  </>
                )}
              </p>
              {account.balanceSources.components.some((c) => c.detailLines?.length) && (
                <div className="mt-4 space-y-2">
                  <p className={dl}>Invoice-level detail (AR sub-ledger)</p>
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-slate-200/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <span>Invoice</span>
                    <span className="text-right">Accumulated</span>
                    <span className="text-right">Running total</span>
                  </div>
                  <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200/80 border-t-0 bg-white p-2 text-xs">
                    {account.balanceSources.components
                      .flatMap((c) =>
                        c.detailLines ? c.detailLines.map((d) => ({ ...d, _src: c.id, _unpaid: c.lineCount })) : []
                      )
                      .map((inv) => (
                        <li
                          key={`${inv._src}-${inv.id}`}
                          className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-slate-50 py-1 font-mono text-slate-700 last:border-0"
                        >
                          <span className="min-w-0">
                            {inv.invoiceNumber || inv.id}{' '}
                            <span className="text-slate-500">({inv.status || '—'})</span>
                          </span>
                          <span className="text-right tabular-nums text-slate-600" title="This invoice (accumulated)">
                            {formatCurrency(inv.accumulatedAmount ?? inv.actualRemaining)}
                          </span>
                          <span className="text-right tabular-nums font-semibold text-indigo-900" title="Running AR total">
                            {inv.runningTotalAfterThisSource != null
                              ? formatCurrency(inv.runningTotalAfterThisSource)
                              : '—'}
                          </span>
                        </li>
                      ))}
                  </ul>
                  {(() => {
                    const ar = account.balanceSources.components.find((c) => c.id === 'ar_unpaid_invoices');
                    if (!ar?.detailLines?.length || !ar.lineCount) return null;
                    if (ar.lineCount <= ar.detailLines.length) return null;
                    return (
                      <p className="mt-1 text-xs text-slate-500">
                        Showing {ar.detailLines.length} of {ar.lineCount} unpaid invoices. Full AR accumulated total:{' '}
                        <span className="font-mono font-semibold text-slate-800">
                          {formatCurrency(ar.accumulatedAmount ?? ar.amount ?? 0)}
                        </span>
                        .
                      </p>
                    );
                  })()}
                </div>
              )}
              {account.balanceSources.notes?.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-600">
                  {account.balanceSources.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

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
