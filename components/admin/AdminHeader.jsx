'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, PanelLeftClose, PanelLeft } from 'lucide-react';
import AdminGlobalSearch from './AdminGlobalSearch';
import { ADMIN_NAV_SECTIONS } from '@/lib/admin/adminNav';
import { cn } from '@/lib/utils';

function resolveTitle(pathname) {
  if (!pathname) return 'System Admin';
  let best = null;
  let bestLen = -1;
  for (const section of ADMIN_NAV_SECTIONS) {
    for (const item of section.items) {
      const candidates = [item, ...(item.subItems || [])];
      for (const c of candidates) {
        if (!c?.href) continue;
        if (
          pathname === c.href ||
          (c.href !== '/insightbooks/dashboard' && pathname.startsWith(`${c.href}/`))
        ) {
          if (c.href.length > bestLen) {
            bestLen = c.href.length;
            best = c.text;
          }
        }
      }
    }
  }
  return best || 'System Admin';
}

function envLabel() {
  const raw =
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    process.env.NODE_ENV ||
    'development';
  return String(raw);
}

export default function AdminHeader({
  admin,
  isMobile,
  sidebarOpen,
  onMenuClick,
  menuButtonRef,
  navId,
  className,
}) {
  const pathname = usePathname();
  const title = useMemo(() => resolveTitle(pathname), [pathname]);
  const env = envLabel();
  const envTone =
    env === 'production' || env === 'prod'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20'
      : env === 'staging' || env === 'preview'
        ? 'bg-amber-50 text-amber-900 ring-amber-600/20'
        : 'bg-slate-100 text-slate-700 ring-slate-500/20';

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* still redirect */
    }
    window.location.href = '/insightbooks/login';
  };

  return (
    <header
      className={cn(
        'flex h-[var(--admin-header-height)] shrink-0 items-center gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-header-bg)] px-3 sm:px-4 lg:px-6',
        className
      )}
    >
      <button
        ref={menuButtonRef}
        type="button"
        onClick={onMenuClick}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--admin-radius)] text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-focus-ring)]"
        aria-controls={navId}
        aria-expanded={isMobile ? sidebarOpen : sidebarOpen}
        aria-label={isMobile ? (sidebarOpen ? 'Close navigation' : 'Open navigation') : 'Toggle navigation'}
      >
        {isMobile ? (
          <Menu className="h-5 w-5" aria-hidden />
        ) : sidebarOpen ? (
          <PanelLeftClose className="h-5 w-5" aria-hidden />
        ) : (
          <PanelLeft className="h-5 w-5" aria-hidden />
        )}
      </button>

      <div className="min-w-0 shrink">
        <p className="truncate text-sm font-semibold tracking-tight text-[var(--admin-text)] sm:text-base">
          {title}
        </p>
        <p className="hidden truncate text-xs text-[var(--admin-text-muted)] sm:block">
          InsightBooks control plane
        </p>
      </div>

      <div className="mx-auto hidden min-w-0 max-w-lg flex-1 md:block">
        <AdminGlobalSearch variant="header" />
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
        <span
          className={cn(
            'hidden rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ring-1 ring-inset sm:inline-flex',
            envTone
          )}
        >
          {env}
        </span>

        <div className="hidden min-w-0 text-right sm:block">
          <div className="truncate text-sm font-medium text-[var(--admin-text)]">
            {admin?.name || 'Admin'}
          </div>
          <div className="truncate text-xs text-[var(--admin-text-muted)]">
            {admin?.role || 'Administrator'}
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex h-11 items-center gap-2 rounded-[var(--admin-radius)] px-2.5 text-sm font-medium text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface-muted)] hover:text-[var(--admin-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-focus-ring)]"
          aria-label="Log out"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          <span className="hidden lg:inline">Log out</span>
        </button>
      </div>
    </header>
  );
}
