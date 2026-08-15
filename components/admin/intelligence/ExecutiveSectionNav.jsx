'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  INTEL_EXECUTIVE_SECTIONS,
  isIntelExecutiveSectionActive,
} from '@/lib/admin/intelligenceNav';
import { cn } from '@/lib/utils';

export default function ExecutiveSectionNav({ className }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'mb-6 flex flex-wrap gap-2 border-b border-[var(--admin-border)] pb-3',
        className
      )}
      aria-label={tt('Executive intelligence sections')}
    >
      {INTEL_EXECUTIVE_SECTIONS.map((section) => {
        const active = isIntelExecutiveSectionActive(pathname, section);
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
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
