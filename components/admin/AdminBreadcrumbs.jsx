'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ADMIN_NAV_SECTIONS, isRemovedAdminRoute, resolveAdminNavLabel } from '@/lib/admin/adminNav';
import { useI18n } from '@/components/i18n/I18nProvider';
import { cn } from '@/lib/utils';

function buildTrail(pathname, t) {
  if (!pathname || isRemovedAdminRoute(pathname)) return [];

  const crumbs = [
    {
      href: '/insightbooks/dashboard',
      label: t('admin-shell.breadcrumbs.home'),
    },
  ];

  let best = null;
  let bestLen = -1;
  let bestParent = null;

  for (const section of ADMIN_NAV_SECTIONS) {
    for (const item of section.items) {
      const candidates = [item, ...(item.subItems || [])];
      for (const c of candidates) {
        if (!c?.href || isRemovedAdminRoute(c.href)) continue;
        if (
          pathname === c.href ||
          (c.href !== '/insightbooks/dashboard' && pathname.startsWith(`${c.href}/`))
        ) {
          if (c.href.length > bestLen) {
            bestLen = c.href.length;
            best = c;
            bestParent = c === item ? null : item;
          }
        }
      }
    }
  }

  if (bestParent && bestParent.href !== '/insightbooks/dashboard') {
    crumbs.push({
      href: bestParent.href,
      label: resolveAdminNavLabel(bestParent, t),
    });
  }

  if (best && best.href !== '/insightbooks/dashboard') {
    crumbs.push({
      href: best.href,
      label: resolveAdminNavLabel(best, t),
      current: true,
    });
  }

  // Dedupe consecutive same href
  return crumbs.filter((c, i, arr) => i === 0 || c.href !== arr[i - 1].href);
}

export default function AdminBreadcrumbs({ className }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const trail = buildTrail(pathname, t);

  if (trail.length <= 1) return null;

  return (
    <nav aria-label={t('admin-shell.breadcrumbs.navAria')} className={cn('min-w-0', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-[var(--admin-text-muted)]">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          return (
            <li key={`${crumb.href}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? <span aria-hidden className="opacity-50">/</span> : null}
              {last || crumb.current ? (
                <span
                  className="truncate font-medium text-[var(--admin-text)]"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate hover:text-[var(--admin-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-focus-ring)]"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
