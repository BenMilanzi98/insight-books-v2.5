'use client';



import { useEffect, useState } from 'react';

import Link from 'next/link';

import { usePathname } from 'next/navigation';

import { useI18n } from '@/components/i18n/I18nProvider';

import {

  PRODUCT_ANALYTICS_SECTIONS,

  isProductAnalyticsSectionActive,

} from '@/lib/admin/productAnalyticsNav';

import { adminHasPermission } from '@/lib/admin/permissions';

import { cn } from '@/lib/utils';



function sectionAllowed(admin, permission) {

  if (!permission) return true;

  if (!admin) return false;

  return adminHasPermission(admin, permission) || admin.role === 'Super Admin';

}



export default function ProductAnalyticsSectionNav({ className }) {

  const pathname = usePathname();

  const { t } = useI18n();

  const [admin, setAdmin] = useState(null);



  useEffect(() => {

    let cancelled = false;

    (async () => {

      try {

        const res = await fetch('/api/admin/auth/me', { credentials: 'include' });

        if (!res.ok) return;

        const body = await res.json().catch(() => ({}));

        if (!cancelled) setAdmin(body.admin || null);

      } catch {

        // Keep gated sections closed until admin is known.

      }

    })();

    return () => {

      cancelled = true;

    };

  }, []);



  return (

    <nav

      className={cn(

        'mb-6 flex flex-wrap gap-2 border-b border-[var(--admin-border)] pb-3',

        className

      )}

      aria-label={t('admin-pages.productAnalytics.sectionNavLabel')}

    >

      {PRODUCT_ANALYTICS_SECTIONS.map((section) => {

        const active = isProductAnalyticsSectionActive(pathname, section);

        const label = section.labelKey ? t(section.labelKey) : section.label;

        const allowed = sectionAllowed(admin, section.permission);



        if (!allowed) {

          return (

            <span

              key={section.id}

              aria-disabled="true"

              title={t('admin-pages.productAnalytics.forbidden')}

              className={cn(

                'cursor-not-allowed rounded-[var(--admin-radius)] px-3 py-1.5 text-sm font-medium opacity-50',

                'border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-muted)] text-[var(--admin-text-muted)]'

              )}

            >

              {label}

            </span>

          );

        }



        return (

          <Link

            key={section.id}

            href={section.href}

            aria-current={active ? 'page' : undefined}

            className={cn(

              'rounded-[var(--admin-radius)] px-3 py-1.5 text-sm font-medium transition-colors',

              active

                ? 'bg-[var(--action-primary)] text-white'

                : 'border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]'

            )}

          >

            {label}

          </Link>

        );

      })}

    </nav>

  );

}


