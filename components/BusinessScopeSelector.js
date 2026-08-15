'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Check, ChevronDown, Search, X } from 'lucide-react';
import {
  readBusinessScopeFromStorage,
  writeBusinessScopeToStorage,
} from '@/lib/businessScopeStorage';

/**
 * Global business scope selector for reports, dashboard, and accounting views.
 *
 * @param {object} props
 * @param {'session'|'all'|'custom'} props.mode
 * @param {string[]} props.selectedTenantIds
 * @param {(mode: 'session'|'all'|'custom', tenantIds: string[]) => void} props.onChange
 * @param {boolean} [props.compact]
 * @param {string} [props.className]
 */
export default function BusinessScopeSelector({
  mode,
  selectedTenantIds,
  onChange,
  compact = false,
  className = '',
}) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [draftIds, setDraftIds] = useState(selectedTenantIds || []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tenant/list', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setTenants(data.tenants || []);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setDraftIds(selectedTenantIds || []);
  }, [selectedTenantIds, open]);

  const hasMultiple = tenants.length > 1;
  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) => String(t.name || '').toLowerCase().includes(q));
  }, [tenants, search]);

  const label = useMemo(() => {
    if (mode === 'session') return 'Current business';
    if (mode === 'all') return `All businesses (${tenants.length})`;
    if (mode === 'custom' && selectedTenantIds?.length) {
      const names = selectedTenantIds
        .map((id) => tenants.find((t) => t.id === id)?.name)
        .filter(Boolean);
      if (names.length === 1) return names[0];
      if (names.length <= 2) return names.join(' + ');
      return `${names.length} businesses selected`;
    }
    return 'Select businesses';
  }, [mode, selectedTenantIds, tenants]);

  const applyMode = useCallback(
    (nextMode, ids = []) => {
      writeBusinessScopeToStorage(nextMode, ids);
      onChange(nextMode, ids);
      setOpen(false);
    },
    [onChange]
  );

  const toggleDraft = (tenantId) => {
    setDraftIds((prev) =>
      prev.includes(tenantId) ? prev.filter((id) => id !== tenantId) : [...prev, tenantId]
    );
  };

  if (loading) {
    return (
      <div className={`animate-pulse h-9 bg-gray-100 rounded-lg ${className}`} aria-hidden />
    );
  }

  if (!hasMultiple) {
    const single = tenants[0];
    return (
      <div
        className={`inline-flex items-center gap-2 text-sm text-gray-600 ${className}`}
        title={single?.name || 'Business'}
      >
        <Building2 className="w-4 h-4 text-blue-600" />
        <span className="font-medium truncate max-w-[200px]">{single?.name || 'Business'}</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 rounded-lg shadow-sm transition-colors ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Building2 className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-blue-600 shrink-0`} />
        <span className="font-medium truncate max-w-[220px]">{label}</span>
        <ChevronDown className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-gray-400 shrink-0`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            <div className="p-3 border-b border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{tt('Business scope')}</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1 rounded hover:bg-gray-100"
                  aria-label={tt('Close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tt('Search businesses…')}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto p-2 space-y-1">
              <ScopeOption
                active={mode === 'session'}
                label="Current business only"
                description="Active session business"
                onClick={() => applyMode('session', [])}
              />
              <ScopeOption
                active={mode === 'all'}
                label="All assigned businesses"
                description={`Consolidated view (${tenants.length})`}
                onClick={() => applyMode('all', tenants.map((t) => t.id))}
              />

              <p className="px-2 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {tt('Select specific businesses')}
              </p>
              {filteredTenants.map((tenant) => {
                const checked = draftIds.includes(tenant.id);
                return (
                  <button
                    key={tenant.id}
                    type="button"
                    onClick={() => toggleDraft(tenant.id)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm hover:bg-gray-50 ${
                      checked ? 'bg-blue-50 text-blue-900' : 'text-gray-800'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}
                    >
                      {checked && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span className="truncate">{tenant.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-3 border-t border-gray-100 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftIds([]);
                  applyMode('session', []);
                }}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {tt('Reset')}
              </button>
              <button
                type="button"
                disabled={!draftIds.length}
                onClick={() => applyMode('custom', draftIds)}
                className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Apply ({draftIds.length || 0})
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ScopeOption({ active, label, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-2 py-2 rounded-lg hover:bg-gray-50 ${
        active ? 'bg-blue-50 ring-1 ring-blue-200' : ''
      }`}
    >
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <p className="text-xs text-gray-500">{description}</p>
    </button>
  );
}

/**
 * Hook for pages that need persisted business scope.
 */
export function useBusinessScope(storageKeyPrefix = '') {
  const scopeKey = storageKeyPrefix
    ? `${storageKeyPrefix}:business-scope`
    : undefined;

  const [mode, setMode] = useState('session');
  const [tenantIds, setTenantIds] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readBusinessScopeFromStorage();
    setMode(stored.mode);
    setTenantIds(stored.tenantIds);
    setHydrated(true);
  }, []);

  const setScope = useCallback((nextMode, ids = []) => {
    setMode(nextMode);
    setTenantIds(ids);
    writeBusinessScopeToStorage(nextMode, ids);
  }, []);

  const querySuffix = useMemo(() => {
    const params = new URLSearchParams();
    if (mode === 'all') params.set('aggregate', 'all');
    else if (mode === 'custom' && tenantIds.length) {
      params.set('tenantIds', tenantIds.join(','));
    }
    const qs = params.toString();
    return qs ? `&${qs}` : '';
  }, [mode, tenantIds]);

  return { mode, tenantIds, setScope, querySuffix, hydrated };
}
