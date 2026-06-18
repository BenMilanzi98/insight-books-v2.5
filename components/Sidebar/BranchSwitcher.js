'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronDown, Check, Building2 } from 'lucide-react';
import { checkPermission } from '@/lib/permissions';

/**
 * Sidebar control to switch the active business (tenant).
 * Uses /api/tenant/list + /api/tenant/switch (same behavior as /switch-tenant).
 */
export default function BranchSwitcher() {
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
      .then((ok) => { if (mounted) setCanManageBusinesses(!!ok); })
      .catch(() => { if (mounted) setCanManageBusinesses(false); });
    return () => { mounted = false; };
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

  if (loading) {
    return (
      <div className="relative inline-block w-full">
        <div className="w-full flex items-center justify-between rounded border border-gray-600 px-3 py-2 text-white bg-gray-800 animate-pulse">
          <div className="flex flex-col items-start gap-0.5 min-w-0">
            <span className="text-[10px] uppercase tracking-wide text-gray-400">
              Businesses
            </span>
            <div className="flex items-center gap-2">
              <Building2 size={16} />
              <span className="truncate text-sm">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="w-full rounded border border-gray-600 px-3 py-2 text-white bg-gray-800 text-sm">
        <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">
          Businesses
        </div>
        {canManageBusinesses ? (
          <Link
            href="/switch-tenant"
            className="text-blue-300 hover:text-blue-200 underline text-xs"
          >
            Add or manage businesses
          </Link>
        ) : (
          <div className="text-gray-300 text-xs">
            No businesses assigned
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative inline-block w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        className="w-full flex items-center justify-between rounded border border-gray-600 px-3 py-2 text-white bg-gray-800 hover:bg-gray-700 transition-colors disabled:opacity-70"
      >
        <div className="flex flex-col items-start gap-0.5 min-w-0 text-left">
          <span className="text-[10px] uppercase tracking-wide text-gray-400">
            Businesses
          </span>
          <div className="flex items-center gap-2 min-w-0">
            <Building2 size={16} className="flex-shrink-0" />
            <span className="truncate text-sm font-medium">
              {currentTenant?.name || 'Select business'}
            </span>
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 max-h-72 overflow-auto">
          <div className="py-1">
            {tenants.map((tenant) => (
              <button
                key={tenant.id}
                type="button"
                onClick={() => handleTenantSelect(tenant)}
                disabled={switching}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-2 ${
                  currentTenantId === tenant.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 size={14} className="flex-shrink-0 text-gray-500" />
                  <span className="truncate">{tenant.name}</span>
                </div>
                {currentTenantId === tenant.id && (
                  <Check size={14} className="flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-200 px-3 py-2 bg-gray-50">
            <Link
              href="/switch-tenant"
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              onClick={() => setIsOpen(false)}
            >
              Add or manage businesses
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
