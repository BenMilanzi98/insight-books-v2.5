'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  TENANT_EIS_NAV_FULL,
  TENANT_EIS_NAV_LOCKED,
} from '@/lib/mraEis/navConfig';

function isActive(pathname, href) {
  if (!pathname || !href) return false;
  if (pathname === href) return true;
  if (href === '/settings/integrations/mra-eis') return false;
  return pathname.startsWith(`${href}/`);
}

export default function TenantMraEisSectionNav() {
  const pathname = usePathname();
  const [items, setItems] = useState([...TENANT_EIS_NAV_LOCKED]);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/mra-eis/availability');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const access = data?.managementAccess;
        setUnlocked(Boolean(access?.unlocked));
        setItems(
          access?.navItems?.length
            ? access.navItems
            : access?.unlocked
              ? [...TENANT_EIS_NAV_FULL]
              : [...TENANT_EIS_NAV_LOCKED]
        );
      } catch {
        /* keep locked defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mb-6">
      {!unlocked ? (
        <p className="mb-2 text-xs text-amber-800">
          Full MRA EIS management unlocks with an active EIS subscription or entitled status.
        </p>
      ) : null}
      <nav
        className="flex flex-wrap gap-2 border-b border-slate-200 pb-3"
        aria-label="MRA EIS sections"
      >
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={`${item.href}-${item.text}`}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white'
                  : 'rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50'
              }
            >
              {item.text}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
