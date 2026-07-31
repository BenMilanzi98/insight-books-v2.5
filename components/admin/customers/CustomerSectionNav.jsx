'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/components/i18n/I18nProvider';
import {
  CUSTOMER_SECTIONS,
  isCustomerSectionActive,
} from '@/lib/admin/customerNav';
import { cn } from '@/lib/utils';

export default function CustomerSectionNav({ className }) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav
      className={cn(
        'mb-6 flex flex-wrap gap-2 border-b border-[var(--admin-border)] pb-3',
        className
      )}
      aria-label={t('admin-pages.customers.sectionNavLabel')}
    >
      {CUSTOMER_SECTIONS.map((section) => {
        const active = isCustomerSectionActive(pathname, section);
        const label = section.labelKey ? t(section.labelKey) : section.label;
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
