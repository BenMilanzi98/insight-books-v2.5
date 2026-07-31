'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Boxes,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ContactRound,
  CreditCard,
  FileCheck,
  Handshake,
  Headset,
  HeartPulse,
  LifeBuoy,
  LayoutDashboard,
  LineChart,
  LogOut,
  Mail,
  Settings,
  Shield,
  Smartphone,
  ToggleLeft,
  Upload,
  Users,
  Package,
} from 'lucide-react';
import { ADMIN_NAV_SECTIONS, resolveAdminNavLabel } from '@/lib/admin/adminNav';
import {
  NAV_PERMISSION_MAP,
  SYSTEM_ADMIN_PERMISSIONS,
  adminHasPermission,
} from '@/lib/admin/permissions';
import { useI18n } from '@/components/i18n/I18nProvider';
import { cn } from '@/lib/utils';

const ICONS = {
  LayoutDashboard,
  LineChart,
  CircleDollarSign,
  ContactRound,
  HeartPulse,
  Boxes,
  Headset,
  LifeBuoy,
  BarChart3,
  Building2,
  Users,
  Settings,
  Smartphone,
  Handshake,
  CreditCard,
  Mail,
  FileCheck,
  Shield,
  Activity,
  ToggleLeft,
  Upload,
  Package,
};

function pathMatches(pathname, href, { exact = false } = {}) {
  if (!pathname || !href) return false;
  if (pathname === href) return true;
  if (exact) return false;
  if (href !== '/insightbooks/dashboard' && pathname.startsWith(`${href}/`)) return true;
  return false;
}

function subItemActive(pathname, sub, siblings = []) {
  if (!pathname || !sub?.href) return false;
  if (sub.exact) return pathname === sub.href;
  if (pathname === sub.href) return true;
  if (!pathname.startsWith(`${sub.href}/`)) return false;
  return !siblings.some(
    (other) =>
      other.href !== sub.href &&
      other.href.length > sub.href.length &&
      (pathname === other.href || pathname.startsWith(`${other.href}/`))
  );
}

function itemVisible(admin, href) {
  const required = NAV_PERMISSION_MAP[href];
  // Unmapped hrefs are hidden — NAV_PERMISSION_MAP must stay complete (see tests).
  if (!required) return false;
  if (!admin) return false;
  if (admin.role === 'Super Admin') return true;
  if (adminHasPermission(admin, required)) return true;
  // Intelligence pack also accepts dashboard.view
  if (
    href.startsWith('/insightbooks/intelligence') &&
    adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.dashboard.view)
  ) {
    return true;
  }
  return false;
}

export default function AdminSidebar({
  collapsed,
  setCollapsed,
  admin,
  isMobile = false,
  onNavigate,
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [expandedItems, setExpandedItems] = useState([]);

  useEffect(() => {
    ADMIN_NAV_SECTIONS.forEach((section) => {
      section.items.forEach((item) => {
        if (
          item.expandable &&
          item.subItems?.some((sub) => pathMatches(pathname, sub.href))
        ) {
          setExpandedItems((prev) =>
            prev.includes(item.href) ? prev : [...prev, item.href]
          );
        }
      });
    });
  }, [pathname]);

  const sections = useMemo(() => {
    return ADMIN_NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.expandable) {
          const subs = (item.subItems || []).filter((sub) =>
            itemVisible(admin, item.href) || itemVisible(admin, sub.href)
          );
          return itemVisible(admin, item.href) || subs.length > 0;
        }
        return itemVisible(admin, item.href);
      }),
    })).filter((section) => section.items.length > 0);
  }, [admin]);

  const toggleExpand = (href) => {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
    );
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } catch {
      /* still redirect */
    }
    window.location.href = '/insightbooks/login';
  };

  const linkClick = () => {
    onNavigate?.();
  };

  const widthClass = collapsed && !isMobile
    ? 'w-[var(--sidebar-collapsed-width)]'
    : 'w-[var(--sidebar-width)]';

  return (
    <div
      className={cn(
        'flex h-full max-h-screen flex-col text-[var(--admin-sidebar-text)]',
        widthClass
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center gap-3 border-b border-white/10 px-3 py-4',
          collapsed && !isMobile ? 'justify-center' : 'px-4'
        )}
      >
        <img
          src="/logo.png"
          alt=""
          className={cn(
            'rounded-md object-contain',
            collapsed && !isMobile ? 'h-8 w-8' : 'h-9 w-9'
          )}
        />
        {!(collapsed && !isMobile) ? (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-white">
              InsightBooks
            </div>
            <div className="truncate text-[11px] uppercase tracking-wide text-[var(--admin-sidebar-muted)]">
              {t('admin-shell.brand')}
            </div>
          </div>
        ) : null}
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3"
        aria-label={t('admin-shell.navAria')}
      >
        {sections.map((section) => (
          <div key={section.id} className="mb-4">
            {!(collapsed && !isMobile) ? (
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-sidebar-muted)]">
                {resolveAdminNavLabel(section, t)}
              </div>
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = ICONS[item.icon] || LayoutDashboard;
                const active =
                  pathMatches(pathname, item.href) ||
                  item.subItems?.some((sub) => pathMatches(pathname, sub.href));
                const expanded = expandedItems.includes(item.href);

                if (item.expandable) {
                  return (
                    <li key={item.href}>
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.href)}
                        title={
                          collapsed && !isMobile
                            ? resolveAdminNavLabel(item, t)
                            : undefined
                        }
                        aria-expanded={expanded}
                        data-active={active ? 'true' : 'false'}
                        className={cn(
                          'admin-nav-item flex min-h-11 w-full items-center gap-3 rounded-[var(--admin-radius)] px-3 py-2.5 text-left text-sm',
                          active
                            ? 'bg-[var(--admin-sidebar-active)] font-medium text-white shadow-[inset_3px_0_0_0_var(--admin-sidebar-accent)]'
                            : 'text-white/80 hover:bg-white/5 hover:text-white'
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-5 w-5 shrink-0',
                            active ? 'text-[var(--admin-sidebar-accent)]' : ''
                          )}
                          aria-hidden
                        />
                        {!(collapsed && !isMobile) ? (
                          <>
                            <span className="min-w-0 flex-1 truncate">
                              {resolveAdminNavLabel(item, t)}
                            </span>
                            {expanded ? (
                              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                            )}
                          </>
                        ) : null}
                      </button>
                      {expanded && !(collapsed && !isMobile) ? (
                        <ul className="mt-0.5 space-y-0.5 border-l border-white/10 ml-5 pl-2">
                          {(item.subItems || []).map((sub) => {
                            const subActive = subItemActive(
                              pathname,
                              sub,
                              item.subItems || []
                            );
                            return (
                              <li key={`${sub.href}-${sub.textKey || sub.text}`}>
                                <Link
                                  href={sub.href}
                                  onClick={linkClick}
                                  aria-current={subActive ? 'page' : undefined}
                                  className={cn(
                                    'block rounded-[var(--radius-md)] px-3 py-2 text-sm',
                                    subActive
                                      ? 'bg-white/10 text-white'
                                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                                  )}
                                >
                                  {resolveAdminNavLabel(sub, t)}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={linkClick}
                      title={
                        collapsed && !isMobile
                          ? resolveAdminNavLabel(item, t)
                          : undefined
                      }
                      data-active={active ? 'true' : 'false'}
                      className={cn(
                        'admin-nav-item flex min-h-11 items-center gap-3 rounded-[var(--admin-radius)] px-3 py-2.5 text-sm',
                        active
                          ? 'bg-[var(--admin-sidebar-active)] font-medium text-white shadow-[inset_3px_0_0_0_var(--admin-sidebar-accent)]'
                          : 'text-white/80 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-5 w-5 shrink-0',
                          active ? 'text-[var(--admin-sidebar-accent)]' : ''
                        )}
                        aria-hidden
                      />
                      {!(collapsed && !isMobile) ? (
                        <span className="min-w-0 truncate">
                          {resolveAdminNavLabel(item, t)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        {!(collapsed && !isMobile) ? (
          <div className="mb-2 px-1 text-[11px] text-[var(--admin-sidebar-muted)]">
            {t('admin-shell.brand')}
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleLogout}
          title={t('admin-shell.logout')}
          className={cn(
            'flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white',
            collapsed && !isMobile && 'justify-center'
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" aria-hidden />
          {!(collapsed && !isMobile) ? <span>{t('admin-shell.logout')}</span> : null}
        </button>
        {typeof setCollapsed === 'function' && !isMobile ? (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="mt-1 hidden w-full rounded-[var(--radius-md)] px-3 py-2 text-xs text-white/50 hover:bg-white/5 hover:text-white/80 md:block"
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
