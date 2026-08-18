'use client';

import Link from 'next/link';
import {
  User,
  Settings,
  Building2,
  FileText,
  Lock,
  LogOut,
} from 'lucide-react';
import { tt } from '@/lib/i18n/runtime';
import PortalPopover from '@/components/ui/PortalPopover';

function tenantLogoSrc(logoUrl) {
  if (typeof window !== 'undefined' && logoUrl?.startsWith('/uploads/')) {
    return `/api/uploads/${logoUrl.replace(/^\/+uploads\//, '')}`;
  }
  return logoUrl;
}

function initialsPlaceholderSrc(name, getInitials) {
  return (
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%233b82f6" rx="20"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="14" font-weight="600" font-family="system-ui">${name ? getInitials(name) : '?'}</text></svg>`
    )
  );
}

function AvatarBubble({ user, isUserLoading, getInitials, size = 40 }) {
  const px = `${size}px`;
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-blue-500 text-sm font-semibold text-white shadow-sm"
      style={{ width: px, height: px, fontSize: size >= 44 ? 18 : 14 }}
    >
      {isUserLoading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
      ) : user?.tenant?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tenantLogoSrc(user.tenant.logoUrl)}
          alt={tt('Logo')}
          className="h-full w-full rounded-full object-cover"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = initialsPlaceholderSrc(user?.name, getInitials);
          }}
          onLoad={(e) => {
            const img = e.target;
            if (img.naturalWidth <= 1 && img.naturalHeight <= 1) {
              img.src = initialsPlaceholderSrc(user?.name, getInitials);
            }
          }}
        />
      ) : (
        getInitials(user?.name)
      )}
    </div>
  );
}

const itemClass =
  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 no-underline transition-colors hover:bg-gray-50 hover:text-gray-900';

/**
 * Account menu styled like Dashboard date/scope pickers
 * (PortalPopover + DashboardMenuPanel: blue accent bar, soft panel).
 */
export default function AppBarProfileMenu({
  open,
  onClose,
  anchorRef,
  user,
  isUserLoading,
  getInitials,
  isMobile,
}) {
  return (
    <PortalPopover
      open={open}
      onClose={onClose}
      anchorRef={anchorRef}
      align="end"
      variant="dashboard"
      estimatedWidth={isMobile ? 300 : 320}
      estimatedHeight={420}
      bodyClassName="p-0"
      className="w-[min(320px,calc(100vw-32px))]"
    >
      <div className="border-b border-gray-100 bg-gradient-to-br from-gray-50 to-white px-4 py-4">
        <div className="flex items-center gap-3">
          <AvatarBubble
            user={user}
            isUserLoading={isUserLoading}
            getInitials={getInitials}
            size={48}
          />
          <div className="min-w-0 flex-1">
            {isUserLoading ? (
              <div className="space-y-2">
                <div className="h-4 w-36 animate-pulse rounded-md bg-gray-200" />
                <div className="h-3 w-28 animate-pulse rounded-md bg-gray-200" />
              </div>
            ) : (
              <>
                <h3 className="m-0 truncate text-base font-semibold leading-tight text-gray-900">
                  {user?.name || 'User'}
                </h3>
                <p className="m-0 truncate text-[13px] text-gray-500">
                  {user?.email || 'user@example.com'}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-0.5 p-2">
        <Link href="/profile" className={itemClass} onClick={onClose}>
          <User className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />
          <span>{tt('My Profile')}</span>
        </Link>
        <Link href="/account" className={itemClass} onClick={onClose}>
          <Settings className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
          <span>{tt('Settings')}</span>
        </Link>
        <Link href="/switch-tenant" className={itemClass} onClick={onClose}>
          <Building2 className="h-4 w-4 shrink-0 text-blue-500" aria-hidden />
          <span>{tt('Switch Or Add Business')}</span>
        </Link>

        <div className="my-1.5 h-px bg-gray-200" />

        <Link href="/terms" className={itemClass} onClick={onClose}>
          <FileText className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
          <span>{tt('Terms of Service')}</span>
        </Link>
        <Link href="/privacy" className={itemClass} onClick={onClose}>
          <Lock className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          <span>{tt('Privacy Policy')}</span>
        </Link>

        <div className="my-1.5 h-px bg-gray-200" />

        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
          onClick={async () => {
            onClose?.();
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/auth/login';
          }}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          <span>{tt('Logout')}</span>
        </button>
      </div>
    </PortalPopover>
  );
}

export { AvatarBubble };
