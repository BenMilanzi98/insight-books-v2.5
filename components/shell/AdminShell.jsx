'use client';

import { Suspense, useCallback, useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import AdminSidebar from '@/components/AdminSidebar/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import AdminNoticeBanner from '@/components/admin/AdminNoticeBanner';
import AdminSupportAccessBanner from '@/components/admin/AdminSupportAccessBanner';
import AdminGlobalSearch from '@/components/admin/AdminGlobalSearch';
import AdminFooter from '@/components/admin/AdminFooter';
import AdminContextBanner from '@/components/admin/AdminContextBanner';
import { useI18n } from '@/components/i18n/I18nProvider';
import { cn } from '@/lib/utils';

/**
 * Platform admin shell — dedicated chrome, independent scroll, mobile drawer a11y.
 * Canonical name: AdminAppShell (aliased export).
 */
export default function AdminShell({ children, admin }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const menuButtonRef = useRef(null);
  const drawerId = useId();

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [pathname, isMobile]);

  const closeMobile = useCallback(() => {
    setSidebarOpen(false);
    menuButtonRef.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!isMobile || !sidebarOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeMobile();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isMobile, sidebarOpen, closeMobile]);

  const toggleSidebar = () => {
    if (isMobile) {
      setSidebarOpen((v) => !v);
    } else {
      setDesktopCollapsed((v) => !v);
      setSidebarOpen(true);
    }
  };

  const sidebarCollapsed = !isMobile && desktopCollapsed;
  const showSidebar = isMobile ? sidebarOpen : true;
  const contentMargin =
    !isMobile && showSidebar
      ? sidebarCollapsed
        ? 'md:ml-[var(--sidebar-collapsed-width)]'
        : 'md:ml-[var(--sidebar-width)]'
      : '';

  return (
    <div className="admin-shell-canvas relative flex h-[100dvh] max-h-[100dvh] w-full overflow-hidden text-[var(--admin-text)]">
      <aside
        id={drawerId}
        aria-label={t('admin-shell.navAria')}
        className={cn(
          'admin-sidebar-shell fixed left-0 top-0 z-[var(--z-drawer)] h-[100dvh] overflow-hidden transition-[transform,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          isMobile
            ? sidebarOpen
              ? 'w-[var(--sidebar-width)] translate-x-0'
              : 'w-[var(--sidebar-width)] -translate-x-full'
            : sidebarCollapsed
              ? 'w-[var(--sidebar-collapsed-width)] translate-x-0'
              : 'w-[var(--sidebar-width)] translate-x-0'
        )}
      >
        {showSidebar || !isMobile ? (
          <AdminSidebar
            collapsed={sidebarCollapsed}
            setCollapsed={setDesktopCollapsed}
            admin={admin}
            isMobile={isMobile}
            onNavigate={isMobile ? closeMobile : undefined}
          />
        ) : null}
      </aside>

      {isMobile && sidebarOpen ? (
        <button
          type="button"
          aria-label={t('admin-shell.closeNav')}
          className="fixed inset-0 z-[var(--z-backdrop)] cursor-pointer bg-slate-900/40"
          onClick={closeMobile}
        />
      ) : null}

      <div
        className={cn(
          'flex h-[100dvh] min-h-0 w-full flex-1 flex-col overflow-hidden transition-[margin] duration-200 ease-[var(--motion-ease)]',
          contentMargin
        )}
      >
        <AdminHeader
          admin={admin}
          isMobile={isMobile}
          sidebarOpen={isMobile ? sidebarOpen : !desktopCollapsed}
          onMenuClick={toggleSidebar}
          menuButtonRef={menuButtonRef}
          navId={drawerId}
        />

        {isMobile ? (
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-header-bg)] px-3 py-2 md:hidden">
            <AdminGlobalSearch variant="header" />
          </div>
        ) : null}

        <main className="main-content-full-width min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="mx-auto w-full max-w-none px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
            <Suspense fallback={null}>
              <AdminNoticeBanner />
            </Suspense>
            <AdminSupportAccessBanner />
            <AdminContextBanner admin={admin} />
            {children}
          </div>
        </main>
        <AdminFooter />
      </div>
    </div>
  );
}

/** Canonical Phase 2 name — same implementation as AdminShell. */
export { AdminShell as AdminAppShell };
