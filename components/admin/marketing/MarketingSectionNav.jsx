'use client';
import { tt } from '@/lib/i18n/runtime';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MARKETING_SECTIONS, isMarketingSectionActive } from '@/lib/admin/marketingNav';
import { adminHasPermission } from '@/lib/admin/permissions';
import { cn } from '@/lib/utils';

function sectionAllowed(admin, permission) {
  if (!permission) return true;
  if (!admin) return false;
  return adminHasPermission(admin, permission) || admin.role === 'Super Admin';
}

export default function MarketingSectionNav({ className }) {
  const pathname = usePathname();
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/auth/me', { credentials: 'include' });
        if (!res.ok) return;
        const body = await res.json().catch(() => ({}));
        if (!cancelled) setAdmin(body.admin || null);
      } catch {
        // Keep gated sections closed until admin is known.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <nav
      className={cn(
        'mb-6 flex flex-wrap gap-2 border-b border-[var(--admin-border)] pb-3',
        className
      )}
      aria-label={tt('Marketing sections')}
    >
      {MARKETING_SECTIONS.map((section) => {
        const active = isMarketingSectionActive(pathname, section);
        const allowed = sectionAllowed(admin, section.permission);

        if (!allowed) {
          return (
            <span
              key={section.id}
              aria-disabled="true"
              title={tt('Insufficient privileges')}
              className={cn(
                'cursor-not-allowed rounded-[var(--admin-radius)] px-3 py-1.5 text-sm font-medium opacity-50',
                'border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-muted)] text-[var(--admin-text-muted)]'
              )}
            >
              {section.label}
            </span>
          );
        }

        return (
          <Link
            key={section.id}
            href={section.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-[var(--admin-radius)] px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-[var(--action-primary)] text-white'
                : 'border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]'
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
