'use client';

import { Suspense, useCallback, useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import AdminSidebar from '@/components/AdminSidebar/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import AdminNoticeBanner from '@/components/admin/AdminNoticeBanner';
import AdminSupportAccessBanner from '@/components/admin/AdminSupportAccessBanner';
import AdminGlobalSearch from '@/components/admin/AdminGlobalSearch';
import { cn } from '@/lib/utils';

/**
 * Platform admin shell — dedicated chrome, independent scroll, mobile drawer a11y.
 */
export default function AdminShell({ children, admin }) {
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
    <div className="relative flex h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-[var(--admin-bg)] text-[var(--admin-text)]">
      <aside
        id={drawerId}
        aria-label="Admin navigation"
        className={cn(
          'fixed left-0 top-0 z-[var(--z-drawer)] h-[100dvh] overflow-hidden bg-[var(--admin-sidebar-bg)] transition-[transform,width] duration-200 ease-[var(--motion-ease)]',
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
          aria-label="Close navigation menu"
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

        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="mx-auto w-full max-w-[var(--admin-content-max)] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
            <Suspense fallback={null}>
              <AdminNoticeBanner />
            </Suspense>
            <AdminSupportAccessBanner />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
