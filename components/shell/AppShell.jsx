'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import ClientConsoleGate from '@/components/ClientConsoleGate';
import Sidebar from '@/components/Sidebar/Sidebar';
import AppBar from '@/components/AppBar';
import Footer from '@/components/Footer';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import AIAssistant from '@/components/AIAssistant';
import OnboardingGate from '@/components/OnboardingGate';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/i18n/I18nProvider';
import RouteDocumentTitle from '@/components/i18n/RouteDocumentTitle';
import DesktopSyncBanner from '@/components/desktop/DesktopSyncBanner';
import DesktopSyncFooter from '@/components/desktop/DesktopSyncFooter';

const HIDDEN_EXACT = ['/', '/auth/login', '/auth/signup', '/contact', '/terms', '/privacy'];

function shouldHideShell(pathname) {
  return (
    HIDDEN_EXACT.includes(pathname) ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/insightbooks/') ||
    pathname.startsWith('/ref/') ||
    pathname.startsWith('/affiliate/')
  );
}

/**
 * Tenant application shell — presentation refactor of RootLayoutClient.
 * Preserves hide-layout path rules, onboarding gate, and nav destinations.
 */
export default function AppShell({ children }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const hide = shouldHideShell(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const menuButtonRef = useRef(null);
  const drawerId = useId();

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [pathname, isMobile]);

  const closeMobile = useCallback(() => {
    setSidebarOpen(false);
    menuButtonRef.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!isMobile || !sidebarOpen || hide) return undefined;
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
  }, [isMobile, sidebarOpen, hide, closeMobile]);

  useEffect(() => {
    if (hide) {
      document.body.classList.remove('tenant-app-active');
      return undefined;
    }
    document.body.classList.add('tenant-app-active');
    return () => {
      document.body.classList.remove('tenant-app-active');
    };
  }, [hide]);

  const toggleSidebar = () => setSidebarOpen((v) => !v);

  return (
    <div className="relative flex h-[100dvh] min-h-0 w-full overflow-hidden bg-[var(--background-secondary)]">
      <RouteDocumentTitle />
      <ClientConsoleGate />

      {!hide && (
        <>
          <aside
            id={drawerId}
            aria-label={t('accessibility.mainNavigation')}
            className={cn(
              'fixed left-0 top-0 z-[var(--z-drawer)] h-[100dvh] overflow-hidden bg-[var(--surface-primary)] shadow-sm transition-[transform,width] duration-200 ease-[var(--motion-ease)]',
              sidebarOpen ? 'w-[var(--sidebar-width)] translate-x-0' : 'w-0 -translate-x-full md:w-0',
              !isMobile && sidebarOpen && 'md:translate-x-0'
            )}
          >
            <Sidebar collapsed={!sidebarOpen} toggleSidebar={toggleSidebar} />
          </aside>

          {isMobile && sidebarOpen ? (
            <button
              type="button"
              aria-label={t('accessibility.closeNavigationMenu')}
              className="fixed inset-0 z-[var(--z-backdrop)] cursor-pointer bg-black/50"
              onClick={closeMobile}
            />
          ) : null}
        </>
      )}

      <div
        className={cn(
          'flex h-[100dvh] min-h-0 w-full flex-1 flex-col overflow-hidden transition-[margin] duration-200 ease-[var(--motion-ease)]',
          !hide && 'tenant-shell-canvas',
          !hide && !isMobile && sidebarOpen && 'md:ml-[var(--sidebar-width)]'
        )}
      >
        {!hide && (
          <AppBar
            toggleSidebar={toggleSidebar}
            isMobile={isMobile}
            sidebarOpen={sidebarOpen}
            menuButtonRef={menuButtonRef}
            navId={drawerId}
          />
        )}
        <DesktopSyncBanner />
        <main
          className={cn(
            'main-content-full-width min-h-0 flex-1 overflow-x-hidden overflow-y-auto',
            !hide && 'px-4 py-4 sm:px-6 sm:py-6 lg:px-8'
          )}
        >
          {hide ? children : <OnboardingGate>{children}</OnboardingGate>}
          {!hide && <DesktopSyncFooter />}
          {!hide && <Footer />}
        </main>
      </div>

      <FloatingWhatsApp />
      {!hide && <AIAssistant />}
    </div>
  );
}
