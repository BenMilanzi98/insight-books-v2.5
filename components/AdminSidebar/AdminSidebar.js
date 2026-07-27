'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Building2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileCheck,
  Handshake,
  LayoutDashboard,
  LogOut,
  Mail,
  Settings,
  Shield,
  Smartphone,
  ToggleLeft,
  Upload,
  Users,
} from 'lucide-react';
import { ADMIN_NAV_SECTIONS } from '@/lib/admin/adminNav';
import { NAV_PERMISSION_MAP, adminHasPermission } from '@/lib/admin/permissions';
import { cn } from '@/lib/utils';

const ICONS = {
  LayoutDashboard,
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
};

function pathMatches(pathname, href) {
  if (!pathname || !href) return false;
  if (pathname === href) return true;
  if (href !== '/insightbooks/dashboard' && pathname.startsWith(`${href}/`)) return true;
  return false;
}

function itemVisible(admin, href) {
  const required = NAV_PERMISSION_MAP[href];
  if (!required) return true;
  if (!admin) return true;
  if (admin.role === 'Super Admin') return true;
  return adminHasPermission(admin, required);
}

export default function AdminSidebar({
  collapsed,
  setCollapsed,
  admin,
  isMobile = false,
  onNavigate,
}) {
  const pathname = usePathname();
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
        'flex h-full max-h-screen flex-col bg-[var(--admin-sidebar-bg)] text-[var(--admin-sidebar-text)]',
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
              Admin
            </div>
          </div>
        ) : null}
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3"
        aria-label="System administration"
      >
        {sections.map((section) => (
          <div key={section.id} className="mb-4">
            {!(collapsed && !isMobile) ? (
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--admin-sidebar-muted)]">
                {section.label}
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
                        title={collapsed && !isMobile ? item.text : undefined}
                        aria-expanded={expanded}
                        className={cn(
                          'flex min-h-11 w-full items-center gap-3 rounded-[var(--admin-radius)] px-3 py-2.5 text-left text-sm transition-colors',
                          active
                            ? 'bg-[var(--admin-sidebar-active)] font-medium text-white'
                            : 'text-white/80 hover:bg-white/5 hover:text-white'
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" aria-hidden />
                        {!(collapsed && !isMobile) ? (
                          <>
                            <span className="min-w-0 flex-1 truncate">{item.text}</span>
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
                            const subActive = pathMatches(pathname, sub.href);
                            return (
                              <li key={sub.href}>
                                <Link
                                  href={sub.href}
                                  onClick={linkClick}
                                  className={cn(
                                    'block rounded-[var(--radius-md)] px-3 py-2 text-sm',
                                    subActive
                                      ? 'bg-white/10 text-white'
                                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                                  )}
                                >
                                  {sub.text}
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
                      title={collapsed && !isMobile ? item.text : undefined}
                      className={cn(
                        'flex min-h-11 items-center gap-3 rounded-[var(--admin-radius)] px-3 py-2.5 text-sm transition-colors',
                        active
                          ? 'bg-[var(--admin-sidebar-active)] font-medium text-white'
                          : 'text-white/80 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden />
                      {!(collapsed && !isMobile) ? (
                        <span className="min-w-0 truncate">{item.text}</span>
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
            InsightBooks Admin
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleLogout}
          title="Logout"
          className={cn(
            'flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white',
            collapsed && !isMobile && 'justify-center'
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" aria-hidden />
          {!(collapsed && !isMobile) ? <span>Logout</span> : null}
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
