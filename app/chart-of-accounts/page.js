"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Plus,
  Search,
  FileSpreadsheet,
  FileDown,
  Upload,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  BookOpen,
  Calendar,
  SlidersHorizontal,
} from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';
import { downloadExcel, downloadExcelWorkbook, downloadPDF } from '@/lib/exportUtils';
import PermissionGuard from '@/components/PermissionGuard';
import BusinessScopeSelector, { useBusinessScope } from '@/components/BusinessScopeSelector';
import SystemLedgerCoaTable from '@/components/chart-of-accounts/SystemLedgerCoaTable';
import { appendBusinessScopeParams } from '@/lib/businessScopeStorage';
import { COA_SYNTHETIC_DIRECT_PREFIX, isCoaSyntheticDirectRow } from '@/lib/coaChartRollup.js';
import { COA_RECONCILE_TOLERANCE } from '@/lib/coaMoney.js';
import {
  findCustomExpensesParentId,
  isCustomExpenseLeafCode,
  nextCustomExpenseCodeHint,
} from '@/lib/customExpenseRange.js';

const ChartOfAccountsPage = () => {
  const {
    mode: businessScopeMode,
    tenantIds: businessScopeTenantIds,
    setScope: setBusinessScope,
    hydrated: businessScopeHydrated,
  } = useBusinessScope();
  const businessScope = useMemo(
    () => ({ mode: businessScopeMode, tenantIds: businessScopeTenantIds }),
    [businessScopeMode, businessScopeTenantIds]
  );

  const [accounts, setAccounts] = useState([]);
  const [coaByTenant, setCoaByTenant] = useState(null);
  const [activeCoaTenantId, setActiveCoaTenantId] = useState('consolidated');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('All');
  const [activeFilter, setActiveFilter] = useState(true);
  const [datePreset, setDatePreset] = useState('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
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

  const DATE_PRESET_OPTIONS = [
    { value: 'day', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: 'year', label: 'This year' },
    { value: 'custom', label: 'Custom' },
  ];

  const displayAccounts = useMemo(() => {
    if (!coaByTenant?.length || activeCoaTenantId === 'consolidated') {
      return accounts;
    }
    const tenantSlice = coaByTenant.find((t) => t.tenantId === activeCoaTenantId);
    return tenantSlice?.accounts || accounts;
  }, [accounts, coaByTenant, activeCoaTenantId]);

  const accountCount = useMemo(
    () => displayAccounts.filter((a) => !isCoaSyntheticDirectRow(a)).length,
    [displayAccounts]
  );

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    accountTypeFilter !== 'All' ||
    !activeFilter ||
    datePreset !== 'month';

  const clearAllFilters = () => {
    setSearchQuery('');
    setAccountTypeFilter('All');
    setActiveFilter(true);
    setDatePreset('month');
  };
  
  // Subtype options by account type
  const accountSubtypes = {
    Asset: ['Group', 'Current Asset', 'Non-current Asset', 'Non-Current Asset'],
    Liability: ['Group', 'Current Liability', 'Non-current Liability', 'Non-Current Liability'],
    Equity: ['Group', 'Equity', 'Capital'],
    Income: ['Group', 'Operating Income', 'Other Income'],
    Expense: ['Group', 'Cost of Sales', 'Operating Expense', 'Other Expense'],
  };

  const toInputDate = (d) => {
    const date = new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const computePresetRange = useCallback((preset) => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    if (preset === 'day') {
      return { from: toInputDate(start), to: toInputDate(end) };
    }
    if (preset === 'week') {
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff);
      return { from: toInputDate(start), to: toInputDate(end) };
    }
    if (preset === 'month') {
      start.setDate(1);
      return { from: toInputDate(start), to: toInputDate(end) };
    }
    if (preset === 'year') {
      start.setMonth(0, 1);
      return { from: toInputDate(start), to: toInputDate(end) };
    }
    return { from: '', to: '' };
  }, []);

  useEffect(() => {
    const range = computePresetRange(datePreset);
    setDateFrom(range.from);
    setDateTo(range.to);
  }, [datePreset, computePresetRange]);

  const loadAccounts = useCallback(async () => {
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      setError('Invalid date range: start date must be before end date.');
      setLoading(false);
      return;
    }
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
      if (dateFrom) {
        params.append('dateFrom', dateFrom);
      }
      if (dateTo) {
        params.append('dateTo', dateTo);
      }
      appendBusinessScopeParams(params, businessScope);

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
      const tenantRows = Array.isArray(data.byTenant) ? data.byTenant : null;
      setCoaByTenant(tenantRows?.length > 1 ? tenantRows : null);
      if (tenantRows?.length > 1) {
        setActiveCoaTenantId((prev) => {
          if (prev === 'consolidated') return prev;
          return tenantRows.some((t) => t.tenantId === prev) ? prev : 'consolidated';
        });
      } else {
        setActiveCoaTenantId('consolidated');
      }
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
  }, [accountTypeFilter, activeFilter, searchQuery, dateFrom, dateTo, businessScope]);

  // Single schedule: no duplicate mount fetch (previously a second effect debounced empty search and raced).
  useEffect(() => {
    if (!businessScopeHydrated) return undefined;
    const delay = searchQuery.trim() ? 300 : 0;
    const timer = setTimeout(() => {
      void loadAccounts();
    }, delay);
    return () => {
      clearTimeout(timer);
      chartFetchAbortRef.current?.abort();
    };
  }, [loadAccounts, businessScopeHydrated]);

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
        const msg =
          data?.code === 'CUSTOM_EXPENSE_RANGE_FULL'
            ? data.error || 'All custom expense account codes (5701–5899) are in use.'
            : data.error || 'Failed to create account';
        throw new Error(msg);
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

  const handleExportExcel = async () => {
    try {
      const periodLabel = dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : (dateFrom ? `From ${dateFrom}` : (dateTo ? `Up to ${dateTo}` : 'All dates'));
      const rows = (accounts || []).map((a) => ({
        period: periodLabel,
        accountCode: a.accountCode || a.code || '',
        accountName: a.accountName || a.name || '',
        accountType: a.accountType || a.type || '',
        normalBalance: a.normalBalance || '',
        currentBalance: Number(a.currentBalance || 0),
        isActive: a.isActive ? 'Yes' : 'No',
      }));
      await downloadExcel(
        rows,
        [
          { key: 'period', label: 'Period' },
          { key: 'accountCode', label: 'Account Code' },
          { key: 'accountName', label: 'Account Name' },
          { key: 'accountType', label: 'Type' },
          { key: 'normalBalance', label: 'Normal Balance' },
          { key: 'currentBalance', label: 'Current Balance' },
          { key: 'isActive', label: 'Active' },
        ],
        'ChartOfAccounts',
        `chart-of-accounts_${dateFrom || 'all'}_${dateTo || 'all'}.xlsx`
      );
    } catch (err) {
      setError(err.message);
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
      const rawId = String(account?.id || '');
      const fetchId = rawId.startsWith(COA_SYNTHETIC_DIRECT_PREFIX)
        ? rawId.slice(COA_SYNTHETIC_DIRECT_PREFIX.length)
        : rawId;
      const qs = new URLSearchParams();
      if (dateFrom) qs.set('dateFrom', dateFrom);
      if (dateTo) qs.set('dateTo', dateTo);
      const q = qs.toString();
      const response = await fetch(
        `/api/chart-of-accounts/${encodeURIComponent(fetchId)}${q ? `?${q}` : ''}`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const data = await response.json();
      if (response.ok && data && !data.error) {
        // Chart grid may roll up children on parents; API returns row-level breakdown in balanceSources.
        const gridBal =
          account.currentBalance != null ? Number(account.currentBalance) : Number(data.currentBalance);
        setSelectedAccount({
          ...data,
          chartGridBalance: gridBal,
          rowOnlyTotalFromApi: Number(data.currentBalance),
          postedDirectBalance:
            account.postedDirectBalance != null ? account.postedDirectBalance : data.postedDirectBalance,
          currentBalance:
            account.currentBalance != null ? account.currentBalance : data.currentBalance,
          coaOpenedFromSyntheticDirect: isCoaSyntheticDirectRow(account),
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
    'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.99]';
  const periodLabel =
    dateFrom && dateTo
      ? `${dateFrom} — ${dateTo}`
      : dateFrom
        ? `From ${dateFrom}`
        : dateTo
          ? `Up to ${dateTo}`
          : 'All dates';
  const filterPillClass = (active) =>
    active
      ? 'bg-slate-900 text-white shadow-sm'
      : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm';

  return (
    <PermissionGuard permission="accounts.view">
      <div className="min-h-screen bg-[#f4f5f7]">
        <div className="mx-auto max-w-[1680px] px-4 py-8 pb-20 sm:px-6 lg:px-10 lg:py-10">
          {/* Header */}
          <header className="mb-6 flex flex-col gap-5 sm:mb-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                <BookOpen size={20} strokeWidth={1.75} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">
                  Chart of accounts
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {!loading && accountCount > 0 ? (
                    <>
                      <span className="font-medium text-slate-700">{accountCount}</span> accounts
                      {periodLabel !== 'All dates' ? (
                        <>
                          {' '}
                          · balances for <span className="font-medium text-slate-700">{periodLabel}</span>
                        </>
                      ) : null}
                    </>
                  ) : (
                    'General ledger structure and posted balances'
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BusinessScopeSelector
                mode={businessScopeMode}
                selectedTenantIds={businessScopeTenantIds}
                onChange={setBusinessScope}
                className="w-full sm:w-auto"
              />
              <button
                type="button"
                onClick={handleInitializeBaseline}
                className={coaBtnSecondary}
                title="Creates missing standard GL accounts, default payment accounts, and tax accounts"
              >
                <CheckCircle size={16} strokeWidth={2} className="text-emerald-600" />
                Sync
              </button>
              <button type="button" onClick={() => handleImportTemplate('retail')} className={coaBtnSecondary}>
                <Upload size={16} strokeWidth={2} />
                Templates
              </button>
              <button type="button" onClick={handleExportExcel} className={coaBtnSecondary}>
                <FileSpreadsheet size={16} strokeWidth={2} />
                Export
              </button>
              <label className={`${coaBtnSecondary} cursor-pointer`}>
                <Upload size={16} strokeWidth={2} />
                Import
                <input type="file" accept=".json,.csv" onChange={handleImport} className="hidden" />
              </label>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99]"
              >
                <Plus size={16} strokeWidth={2.5} />
                Add account
              </button>
            </div>
          </header>

          {/* Filters */}
          <section
            className="mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
            aria-label="Chart of accounts filters"
          >
            <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
              <div className="relative">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  strokeWidth={2}
                />
                <input
                  type="search"
                  placeholder="Search by code, name, or description…"
                  className="w-full rounded-xl border-0 bg-slate-50 py-2.5 pl-10 pr-10 text-sm text-slate-900 ring-1 ring-slate-200/80 transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700"
                    aria-label="Clear search"
                  >
                    <X size={15} strokeWidth={2} />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="space-y-4 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <SlidersHorizontal size={13} strokeWidth={2} />
                    Type
                  </span>
                  <div className="overflow-x-auto rounded-xl bg-slate-100/80 p-1">
                    <div className="flex w-max gap-0.5">
                      <button
                        type="button"
                        onClick={() => setAccountTypeFilter('All')}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${filterPillClass(accountTypeFilter === 'All')}`}
                      >
                        All
                      </button>
                      {accountTypes.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setAccountTypeFilter(type)}
                          className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${filterPillClass(accountTypeFilter === type)}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</span>
                  <div className="rounded-xl bg-slate-100/80 p-1">
                    <div className="flex gap-0.5">
                      <button
                        type="button"
                        onClick={() => setActiveFilter(true)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${filterPillClass(activeFilter)}`}
                      >
                        Active
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFilter(false)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${filterPillClass(!activeFilter)}`}
                      >
                        All
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <Calendar size={13} strokeWidth={2} />
                    Period
                  </span>
                  <div className="overflow-x-auto rounded-xl bg-slate-100/80 p-1">
                    <div className="flex w-max gap-0.5">
                      {DATE_PRESET_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setDatePreset(opt.value)}
                          className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${filterPillClass(datePreset === opt.value)}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDatePreset('custom');
                      setDateFrom(e.target.value);
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-800 transition focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    aria-label="Balance from date"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDatePreset('custom');
                      setDateTo(e.target.value);
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-800 transition focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    aria-label="Balance to date"
                  />
                </div>
              </div>

              {hasActiveFilters ? (
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <p className="text-xs text-slate-500">Filters applied</p>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-xs font-semibold text-slate-600 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-900"
                  >
                    Reset filters
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          {error && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
            >
              <AlertCircle size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {coaByTenant?.length > 1 ? (
            <div className="mb-4 overflow-x-auto rounded-xl bg-slate-100/80 p-1">
              <div className="flex w-max gap-0.5">
                <button
                  type="button"
                  onClick={() => setActiveCoaTenantId('consolidated')}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    activeCoaTenantId === 'consolidated'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm'
                  }`}
                >
                  Consolidated
                </button>
                {coaByTenant.map((tenant) => (
                  <button
                    key={tenant.tenantId}
                    type="button"
                    onClick={() => setActiveCoaTenantId(tenant.tenantId)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      activeCoaTenantId === tenant.tenantId
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm'
                    }`}
                  >
                    {tenant.tenantName || tenant.businessName || 'Business'}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <SystemLedgerCoaTable
            loading={loading}
            accounts={displayAccounts}
            activeFilter={activeFilter}
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
            chartAccounts={accounts}
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

  const isNewCustomExpense = !isEdit && formData.accountType === 'Expense';
  const isLockedCustomExpenseChild =
    isEdit && isCustomExpenseLeafCode(account?.accountCode || account?.code);
  const parent5700Id = useMemo(() => findCustomExpensesParentId(accounts), [accounts]);

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
                Account code{' '}
                <span className="font-normal normal-case text-slate-400">
                  {isNewCustomExpense ? '(auto-assigned 5701–5899)' : '(required, numeric)'}
                </span>
              </label>
              {isNewCustomExpense ? (
                <div
                  className={`${field} bg-slate-50 text-sm text-slate-700`}
                  title="The next free code in 5701–5899 is assigned when you create the account."
                >
                  {nextCustomExpenseCodeHint(accounts)}
                  {!parent5700Id ? (
                    <span className="mt-2 block text-xs font-medium text-amber-800">
                      Custom Expenses (5700) is not in your ledger yet — it will be created when you save, or use
                      &quot;Sync standard CoA&quot; first.
                    </span>
                  ) : null}
                </div>
              ) : (
                <input
                  type="text"
                  value={formData.accountCode}
                  onChange={(e) => setFormData({ ...formData, accountCode: e.target.value })}
                  className={field}
                  placeholder="e.g. 1010"
                  disabled={
                    isEdit &&
                    (account?.transactionCount > 0 ||
                      account?.isSystem ||
                      isCustomExpenseLeafCode(account?.accountCode || account?.code))
                  }
                />
              )}
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
                onChange={(e) => {
                  const v = e.target.value;
                  setFormData((prev) => {
                    const next = { ...prev, accountType: v, accountSubtype: '' };
                    if (!isEdit && v === 'Expense') {
                      next.parentAccountId = findCustomExpensesParentId(accounts);
                      next.accountCode = '';
                    }
                    if (!isEdit && v !== 'Expense' && prev.accountType === 'Expense') {
                      next.parentAccountId = '';
                    }
                    return next;
                  });
                }}
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
                Parent{' '}
                <span className="font-normal normal-case text-slate-400">
                  {isNewCustomExpense ? '(Custom Expenses 5700)' : '(optional)'}
                </span>
              </label>
              {isNewCustomExpense || isLockedCustomExpenseChild ? (
                <div className={`${field} bg-slate-50 text-sm text-slate-800`}>
                  {isLockedCustomExpenseChild
                    ? '5700 — Custom Expenses (required parent for this account)'
                    : parent5700Id
                      ? '5700 — Custom Expenses (locked for new expense accounts)'
                      : '5700 — Custom Expenses (assigned on save)'}
                </div>
              ) : (
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
              )}
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

/** Chart list subtree under `rootId` with rolled balances (depth-first by code). */
function collectChartSubtreeRows(rootId, chartAccounts) {
  if (!rootId || !Array.isArray(chartAccounts)) return [];
  const byParent = new Map();
  for (const a of chartAccounts) {
    const pid = a.parentAccountId;
    if (!pid) continue;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(a);
  }
  const codeSort = (x, y) =>
    String(x.accountCode || x.code || '').localeCompare(String(y.accountCode || y.code || ''), undefined, {
      numeric: true,
    });
  const out = [];
  const walk = (parentId, depth) => {
    const kids = [...(byParent.get(parentId) || [])].sort(codeSort);
    for (const k of kids) {
      out.push({ row: k, depth });
      walk(k.id, depth + 1);
    }
  };
  walk(rootId, 0);
  return out;
}

function safeCoaExportBasename(codeRaw) {
  const c = String(codeRaw || 'account').trim().replace(/[^\w.-]+/g, '_');
  return c || 'account';
}

// View Account Modal Component
const ViewAccountModal = ({ account, chartAccounts = [], onClose }) => {
  const dl = 'text-xs font-semibold uppercase tracking-wider text-slate-500';
  const card = 'rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.03]';
  const btnExport =
    'inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:flex-initial';

  const subtreeRows = useMemo(
    () => collectChartSubtreeRows(account?.id, chartAccounts),
    [account?.id, chartAccounts]
  );

  const chartBalanceMain =
    account.chartGridBalance != null ? Number(account.chartGridBalance) : Number(account.currentBalance) || 0;

  const descendantsTotal = useMemo(
    () => subtreeRows.reduce((s, { row }) => s + (Number(row.currentBalance) || 0), 0),
    [subtreeRows]
  );

  const subtreeMismatch =
    subtreeRows.length > 0 && Math.abs(descendantsTotal - chartBalanceMain) > COA_RECONCILE_TOLERANCE;

  const handleExportExcel = useCallback(async () => {
    const code = safeCoaExportBasename(account.accountCode || account.code);
    const name = account.accountName || account.name || '';
    const summaryHeaders = [
      { key: 'field', label: 'Field' },
      { key: 'value', label: 'Value' },
    ];
    const summaryData = [
      { field: 'Account code', value: account.accountCode || account.code || '' },
      { field: 'Account name', value: name },
      { field: 'Type', value: account.accountType || account.type || '' },
      { field: 'Sub-type', value: account.accountSubtype || '' },
      { field: 'Normal balance', value: account.normalBalance || '' },
      {
        field: 'Chart balance (grid)',
        value: chartBalanceMain,
      },
      {
        field: 'Posted on this code only (API)',
        value:
          account.balanceSources?.displayedRowTotal != null
            ? Number(account.balanceSources.displayedRowTotal)
            : Number(account.postedDirectBalance ?? account.currentBalance) || 0,
      },
      { field: 'Posted transaction lines (est.)', value: account.transactionCount ?? 0 },
      { field: 'Status', value: account.isActive !== false ? 'Active' : 'Inactive' },
      { field: 'Parent', value: account.parentAccount ? `${account.parentAccount.accountCode} — ${account.parentAccount.accountName || ''}` : '' },
      {
        field: 'Sum of sub-account chart balances',
        value: descendantsTotal,
      },
    ];

    const subHeaders = [
      { key: 'level', label: 'Level' },
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status' },
      { key: 'chartBalance', label: 'Chart balance' },
    ];
    const subData = subtreeRows.map(({ row, depth }) => ({
      level: depth + 1,
      code: row.accountCode || row.code || '',
      name: row.accountName || row.name || '',
      type: row.accountType || row.type || '',
      status: row.isActive !== false ? 'Active' : 'Inactive',
      chartBalance: Number(row.currentBalance) || 0,
    }));

    const sheets = [
      { name: 'Summary', data: summaryData, headers: summaryHeaders },
      { name: 'Sub-accounts', data: subData, headers: subHeaders },
    ];

    if (account.balanceSources?.components?.length) {
      const compHeaders = [
        { key: 'source', label: 'Source' },
        { key: 'debit', label: 'Debit' },
        { key: 'credit', label: 'Credit' },
        { key: 'net', label: 'Net / amount' },
        { key: 'lines', label: 'Lines' },
      ];
      const compData = account.balanceSources.components.map((row) => ({
        source: row.note ? `${row.label} — ${row.note}` : row.label,
        debit: row.debit != null ? Number(row.debit) : '',
        credit: row.credit != null ? Number(row.credit) : '',
        net:
          row.netEffect != null
            ? Number(row.netEffect)
            : row.amount != null
              ? Number(row.amount)
              : '',
        lines: row.lineCount != null ? row.lineCount : '',
      }));
      sheets.push({ name: 'Balance composition', data: compData, headers: compHeaders });
    }

    await downloadExcelWorkbook(sheets, `${code}_account_details.xlsx`);
  }, [account, chartBalanceMain, descendantsTotal, subtreeRows]);

  const handleExportPdf = useCallback(() => {
    const code = safeCoaExportBasename(account.accountCode || account.code);
    const name = account.accountName || account.name || 'Account';
    const summaryData = [
      { label: 'Account code', value: account.accountCode || account.code || '—' },
      { label: 'Name', value: name },
      { label: 'Type', value: account.accountType || account.type || '—' },
      { label: 'Chart balance (grid)', value: formatCurrency(chartBalanceMain) },
      {
        label: 'Posted on this code (detail)',
        value: formatCurrency(
          account.balanceSources?.displayedRowTotal != null
            ? Number(account.balanceSources.displayedRowTotal)
            : Number(account.postedDirectBalance ?? account.currentBalance) || 0
        ),
      },
      { label: 'Transactions (posted lines est.)', value: String(account.transactionCount ?? 0) },
      { label: 'Sub-accounts listed', value: String(subtreeRows.length) },
      { label: 'Sum of sub-account balances', value: formatCurrency(descendantsTotal) },
    ];

    const pdfRows = subtreeRows.map(({ row, depth }) => ({
      code: `${'· '.repeat(depth)}${row.accountCode || row.code || ''}`,
      name: row.accountName || row.name || '',
      type: row.accountType || row.type || '',
      balance: Number(row.currentBalance) || 0,
    }));

    const sections = [];
    if (account.balanceSources?.components?.length) {
      sections.push({
        title: 'Balance composition',
        table: {
          headers: ['Source', 'Net / amount', 'Lines'],
          data: account.balanceSources.components.map((row) => [
            row.note ? `${row.label} (${row.note})` : row.label,
            formatCurrency(row.netEffect != null ? row.netEffect : row.amount ?? 0),
            row.lineCount != null ? String(row.lineCount) : '—',
          ]),
        },
      });
    }

    downloadPDF(
      {
        title: 'Chart of accounts — account details',
        subtitle: `${account.accountCode || account.code || ''} — ${name}`,
        summaryData,
        data: pdfRows,
        headers: [
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
          { key: 'type', label: 'Type' },
          { key: 'balance', label: 'Chart balance', format: 'currency' },
        ],
        sections,
      },
      `${code}_account_details.pdf`
    );
  }, [account, chartBalanceMain, descendantsTotal, subtreeRows]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/20 flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="coa-view-account-title"
      >
        <div className="shrink-0 border-b border-indigo-100/80 bg-gradient-to-br from-indigo-50/90 via-white to-slate-50 px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Account details</p>
              <h2 id="coa-view-account-title" className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {account.accountName || account.name || 'Unnamed account'}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-indigo-600/10 px-2.5 py-1 font-mono text-sm font-semibold text-indigo-800 ring-1 ring-indigo-200/60">
                  {account.accountCode || account.code || 'N/A'}
                </span>
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                  {account.accountType || account.type || '—'}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <button type="button" className={btnExport} onClick={handleExportExcel} aria-label="Export Excel">
                <FileSpreadsheet size={18} strokeWidth={2} className="text-emerald-600" />
                Excel
              </button>
              <button type="button" className={btnExport} onClick={handleExportPdf} aria-label="Export PDF">
                <FileDown size={18} strokeWidth={2} className="text-rose-600" />
                PDF
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-white/80 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={22} strokeWidth={2} />
              </button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/60 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm">
              <p className={dl}>Chart balance</p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">
                {formatCurrency(chartBalanceMain)}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">As shown on the CoA grid (includes roll-ups).</p>
            </div>
            <div className="rounded-xl border border-white/60 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm">
              <p className={dl}>Sub-accounts</p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">{subtreeRows.length}</p>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">Direct & nested under this account in the chart.</p>
            </div>
            <div className="rounded-xl border border-white/60 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm">
              <p className={dl}>Posted activity</p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">{account.transactionCount ?? 0}</p>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">Journal + GL lines on this code (detail API).</p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className={card}>
                <p className={dl}>Classification</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                    <dt className="text-slate-500">Sub-type</dt>
                    <dd className="font-medium text-slate-900">{account.accountSubtype || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                    <dt className="text-slate-500">Normal balance</dt>
                    <dd className="font-medium text-slate-900">{account.normalBalance || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3 pt-1">
                    <dt className="text-slate-500">Status</dt>
                    <dd>
                      {account.isActive !== false ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle size={16} strokeWidth={2} className="text-emerald-600" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-500">
                          <XCircle size={16} strokeWidth={2} />
                          Inactive
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className={card}>
                <p className={dl}>Hierarchy</p>
                {account.parentAccount ? (
                  <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-slate-500">Parent · </span>
                    <span className="font-mono font-semibold text-indigo-800">
                      {account.parentAccount.accountCode || account.parentAccount.code || '—'}
                    </span>
                    <span className="text-slate-700"> — {account.parentAccount.accountName || account.parentAccount.name || ''}</span>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Top-level (no parent)</p>
                )}
                {account.description ? (
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{account.description}</p>
                ) : null}
              </div>
            </div>

            <div className={card}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className={dl}>Sub-account balances</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Amounts match the chart grid for each descendant. Sum of rows:{' '}
                    <span className="font-mono font-semibold text-slate-900">{formatCurrency(descendantsTotal)}</span>
                  </p>
                </div>
                {subtreeMismatch ? (
                  <p className="text-xs font-medium text-amber-800">
                    Differs from parent chart total ({formatCurrency(chartBalanceMain)}); normal when filters hide rows or roll-ups differ.
                  </p>
                ) : null}
              </div>
              {subtreeRows.length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
                  No sub-accounts in the current chart list for this account.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200/90">
                  <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-100/95 text-xs font-semibold uppercase tracking-wide text-slate-600 backdrop-blur">
                      <tr>
                        <th className="px-3 py-2.5">Code</th>
                        <th className="px-3 py-2.5">Name</th>
                        <th className="hidden px-3 py-2.5 sm:table-cell">Type</th>
                        <th className="px-3 py-2.5 text-right">Chart balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subtreeRows.map(({ row, depth }) => (
                        <tr key={row.id} className="bg-white hover:bg-slate-50/80">
                          <td className="px-3 py-2.5 font-mono text-xs font-semibold tabular-nums text-indigo-800 sm:text-sm">
                            <span style={{ paddingLeft: `${depth * 14}px` }} className="inline-block border-l-2 border-indigo-200 pl-2">
                              {row.accountCode || row.code}
                            </span>
                          </td>
                          <td className="max-w-[200px] truncate px-3 py-2.5 text-slate-800 sm:max-w-none">{row.accountName || row.name}</td>
                          <td className="hidden px-3 py-2.5 capitalize text-slate-600 sm:table-cell">{row.accountType || row.type || '—'}</td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {formatCurrency(Number(row.currentBalance) || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {subtreeRows.length > 0 ? (
                      <tfoot>
                        <tr className="bg-slate-50 font-semibold">
                          <td colSpan={3} className="px-3 py-2.5 text-right text-slate-600">
                            Total (sum of listed sub-accounts)
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-indigo-900">
                            {formatCurrency(descendantsTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className={card}>
                <p className={dl}>Balance vs chart</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  <li>
                    <span className="text-slate-500">Chart total: </span>
                    <span className="font-mono font-semibold">{formatCurrency(chartBalanceMain)}</span>
                  </li>
                  {account.balanceSources &&
                    Math.abs(chartBalanceMain - Number(account.balanceSources.displayedRowTotal)) >
                      COA_RECONCILE_TOLERANCE && (
                      <li className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                        This code alone (no child rollup in detail):{' '}
                        <span className="font-mono font-semibold">
                          {formatCurrency(account.balanceSources.displayedRowTotal)}
                        </span>
                        . The chart total includes rolled-up sub-accounts when this row is a parent.
                      </li>
                    )}
                  {account.postedDirectBalance != null &&
                    Math.abs(Number(account.postedDirectBalance) - Number(account.currentBalance || 0)) >
                      COA_RECONCILE_TOLERANCE && (
                      <li className="text-xs text-slate-600">
                        Posted on this code only: {formatCurrency(account.postedDirectBalance)}. Grid total can include
                        sub-ledgers.
                      </li>
                    )}
                </ul>
              </div>
            </div>

            {account.balanceSources && (
              <div className={card}>
                <p className={dl}>Balance composition (detail)</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Source: <span className="font-mono text-slate-800">{account.balanceSources.balanceSource}</span>
                  {account.balanceSources.mergeRollupPostingAccountCount > 1 && (
                    <>
                      {' '}
                      · CoA merge rollup:{' '}
                      <span className="font-mono">{account.balanceSources.mergeRollupPostingAccountCount}</span> account ids
                      post into this code
                    </>
                  )}
                </p>
                {account.balanceSources.reconciliationHint && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{account.balanceSources.reconciliationHint}</p>
                )}
                <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200/80">
                  <table className="min-w-[720px] w-full text-left text-sm text-slate-800">
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
                            {row.note && <div className="mt-0.5 text-xs font-normal text-slate-500">{row.note}</div>}
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
                    <> (last running total should match the active source row)</>
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
                          c.detailLines ? c.detailLines.map((d) => ({ ...d, _src: c.id })) : []
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
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 min-h-[44px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChartOfAccountsPage;
