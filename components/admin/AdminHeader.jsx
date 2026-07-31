'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, PanelLeftClose, PanelLeft } from 'lucide-react';
import AdminGlobalSearch from './AdminGlobalSearch';
import AdminBreadcrumbs from './AdminBreadcrumbs';
import AdminLanguageSwitcher from './AdminLanguageSwitcher';
import AdminNotificationCentre from './AdminNotificationCentre';
import {
  ADMIN_NAV_SECTIONS,
  resolveAdminNavLabel,
} from '@/lib/admin/adminNav';
import { useI18n } from '@/components/i18n/I18nProvider';
import { cn } from '@/lib/utils';

function resolveTitle(pathname, t) {
  if (!pathname) return t('admin-shell.brand');
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
            best = c;
          }
        }
      }
    }
  }
  return best ? resolveAdminNavLabel(best, t) : t('admin-shell.brand');
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
  const { t } = useI18n();
  const title = useMemo(() => resolveTitle(pathname, t), [pathname, t]);
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
        'admin-header-shell flex h-[var(--admin-header-height)] shrink-0 items-center gap-3 border-b-2 border-transparent px-3 sm:px-4 lg:px-6',
        className
      )}
      style={{
        borderBottomColor: 'transparent',
        boxShadow: 'inset 0 -2px 0 0 transparent',
        backgroundImage:
          'linear-gradient(var(--admin-header-bg), var(--admin-header-bg)), linear-gradient(90deg, #0ea5e9, #10b981, #f59e0b)',
        backgroundSize: '100% 100%, 100% 2px',
        backgroundPosition: '0 0, 0 100%',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <button
        ref={menuButtonRef}
        type="button"
        onClick={onMenuClick}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--admin-radius)] text-[var(--admin-text)] transition-colors hover:bg-[var(--admin-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-focus-ring)]"
        aria-controls={navId}
        aria-expanded={isMobile ? sidebarOpen : sidebarOpen}
        aria-label={
          isMobile
            ? sidebarOpen
              ? t('admin-shell.closeNav')
              : t('admin-shell.openNav')
            : t('admin-shell.toggleNav')
        }
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
        <AdminBreadcrumbs className="mt-0.5 hidden sm:block" />
      </div>

      <div className="mx-auto hidden min-w-0 max-w-lg flex-1 transition-shadow duration-200 focus-within:drop-shadow-sm md:block">
        <AdminGlobalSearch variant="header" />
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
        <span
          className={cn(
            'hidden rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ring-1 ring-inset sm:inline-flex',
            envTone
          )}
        >
          {env}
        </span>

        <AdminLanguageSwitcher className="hidden sm:inline-flex" />
        <AdminNotificationCentre />

        <div className="hidden min-w-0 text-right md:block">
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
          aria-label={t('admin-shell.logout')}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          <span className="hidden lg:inline">{t('admin-shell.logout')}</span>
        </button>
      </div>
    </header>
  );
}
