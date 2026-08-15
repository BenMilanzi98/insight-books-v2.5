'use client';
import { tt } from '@/lib/i18n/runtime';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronDown, Check, Building2 } from 'lucide-react';
import { checkPermission } from '@/lib/permissions';

/**
 * Compact sidebar control: selected business + plan/expiry + tenant switch dropdown.
 */
export default function BranchSwitcher({
  planLabel = null,
  expiryLabel = null,
  isTrial = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [currentTenantId, setCurrentTenantId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [canManageBusinesses, setCanManageBusinesses] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/tenant/list', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setTenants(data.tenants || []);
          setCurrentTenantId(data.currentTenantId || null);
        }
      } catch (error) {
        console.error('Error fetching tenants:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    let mounted = true;
    checkPermission('system.switchTenant')
      .then((ok) => {
        if (mounted) setCanManageBusinesses(!!ok);
      })
      .catch(() => {
        if (mounted) setCanManageBusinesses(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isOpen]);

  const currentTenant = tenants.find((t) => t.id === currentTenantId);

  const handleTenantSelect = async (tenant) => {
    if (!tenant?.id || tenant.id === currentTenantId || switching) {
      setIsOpen(false);
      return;
    }
    setSwitching(true);
    try {
      const res = await fetch('/api/tenant/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id }),
      });
      if (res.ok) {
        setCurrentTenantId(tenant.id);
        setIsOpen(false);
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Error switching business:', error);
    } finally {
      setSwitching(false);
    }
  };

  const metaLine =
    planLabel || expiryLabel
      ? [planLabel, expiryLabel].filter(Boolean).join(' · ')
      : null;

  if (loading) {
    return (
      <div className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 animate-pulse">
        <div className="h-3.5 w-28 rounded bg-white/10 mb-1.5" />
        <div className="h-2.5 w-36 rounded bg-white/10" />
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-white">
        {canManageBusinesses ? (
          <Link href="/switch-tenant" className="text-blue-300 hover:text-blue-200 text-xs underline">
            {tt('Add or manage businesses')}
          </Link>
        ) : (
          <div className="text-gray-400 text-xs">{tt('No businesses assigned')}</div>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-2 text-left text-white hover:bg-white/[0.1] transition-colors disabled:opacity-70"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Building2 size={14} className="flex-shrink-0 text-sky-300" />
            <span className="truncate text-[13px] font-semibold leading-tight">
              {currentTenant?.name || 'Select business'}
            </span>
          </div>
          {metaLine && (
            <div
              className={`mt-0.5 truncate pl-[20px] text-[10px] leading-tight ${
                isTrial ? 'text-amber-300/90' : 'text-sky-300/80'
              }`}
            >
              {metaLine}
            </div>
          )}
        </div>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 text-white/70 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="max-h-64 overflow-auto py-1">
            {tenants.map((tenant) => (
              <button
                key={tenant.id}
                type="button"
                onClick={() => handleTenantSelect(tenant)}
                disabled={switching}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                  currentTenantId === tenant.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 size={14} className="flex-shrink-0 text-gray-500" />
                  <span className="truncate">{tenant.name}</span>
                </div>
                {currentTenantId === tenant.id && <Check size={14} className="flex-shrink-0" />}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 flex items-center justify-between gap-2">
            <Link
              href="/switch-tenant"
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              onClick={() => setIsOpen(false)}
            >
              {tt('Manage businesses')}
            </Link>
            <Link
              href="/subscription"
              className="text-xs text-gray-500 hover:text-gray-700"
              onClick={() => setIsOpen(false)}
            >
              {tt('Subscription')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
