'use client';
import { tt } from '@/lib/i18n/runtime';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminGlobalSearch({ className, variant = 'default' }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [groups, setGroups] = useState([]);
  const inputId = useId();
  const timer = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!q || q.trim().length < 2) {
      setGroups([]);
      setError('');
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/search?q=${encodeURIComponent(q.trim())}&limit=8`,
          { credentials: 'include' }
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Search failed');
        const r = body.results || {};
        const next = [];
        if (Array.isArray(r.tenants) && r.tenants.length) {
          next.push({
            type: 'tenants',
            label: 'Tenants',
            items: r.tenants.map((t) => ({
              id: t.id,
              title: t.name,
              subtitle: t.subdomain || t.status,
              href: `/insightbooks/tenants/${t.id}/dashboard`,
            })),
          });
        }
        if (Array.isArray(r.users) && r.users.length) {
          next.push({
            type: 'users',
            label: 'Users',
            items: r.users.map((u) => ({
              id: u.id,
              title: u.name || u.email,
              subtitle: u.email,
              href: '/insightbooks/user-management',
            })),
          });
        }
        if (Array.isArray(r.affiliates) && r.affiliates.length) {
          next.push({
            type: 'affiliates',
            label: 'Affiliates',
            items: r.affiliates.map((a) => ({
              id: a.id,
              title: a.name,
              subtitle: a.email || a.referralCode,
              href: '/insightbooks/affiliate',
            })),
          });
        }
        setGroups(next);
        setError('');
        setOpen(true);
      } catch (e) {
        setGroups([]);
        setError(e.message || 'Search failed');
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  const headerish = variant === 'header';

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative min-w-0 flex-1',
        headerish ? 'max-w-none' : 'max-w-md',
        className
      )}
    >
      <label htmlFor={inputId} className="sr-only">
        {tt('Search administration')}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-text-muted)]"
          aria-hidden
        />
        <input
          id={inputId}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => {
            if (groups.length || error) setOpen(true);
          }}
          placeholder={tt('Search tenants, users, affiliates…')}
          className={cn(
            'w-full rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] py-2 pl-9 pr-9 text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-focus-ring)]',
            headerish ? 'h-10 bg-[var(--admin-surface-muted)]' : 'bg-[var(--admin-surface)]'
          )}
          autoComplete="off"
        />
        {q ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
            onClick={() => {
              setQ('');
              setOpen(false);
            }}
            aria-label={tt('Clear search')}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {open ? (
        <div
          className="absolute z-[var(--z-dropdown)] mt-1 max-h-80 w-full overflow-auto rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-primary)] shadow-[var(--shadow-modal)]"
          role="listbox"
          aria-label={tt('Search results')}
        >
          {loading ? (
            <p className="px-3 py-3 text-sm text-[var(--text-muted)]">{tt('Searching…')}</p>
          ) : null}
          {!loading && error ? (
            <p className="px-3 py-3 text-sm text-[var(--status-danger)]" role="alert">
              {error}
            </p>
          ) : null}
          {!loading && !error && groups.length === 0 && q.trim().length >= 2 ? (
            <p className="px-3 py-3 text-sm text-[var(--text-muted)]">{tt('No results')}</p>
          ) : null}
          {!loading &&
            !error &&
            groups.map((group) => (
              <div key={group.type || group.label} className="border-t border-[var(--border-default)] first:border-t-0">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {group.label || group.type}
                </div>
                <ul>
                  {(group.items || []).map((item) => (
                    <li key={item.id || item.href}>
                      <Link
                        href={item.href}
                        className="block px-3 py-2 text-sm hover:bg-[var(--surface-muted)]"
                        onClick={() => setOpen(false)}
                      >
                        <div className="truncate font-medium text-[var(--text-primary)]">
                          {item.title || item.name}
                        </div>
                        {item.subtitle ? (
                          <div className="truncate text-xs text-[var(--text-secondary)]">
                            {item.subtitle}
                          </div>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}
