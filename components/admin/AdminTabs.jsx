'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { cn } from '@/lib/utils';

/**
 * @param {{ tabs: { id: string, label: string, panelId?: string }[], activeId: string, onChange: (id: string) => void, className?: string }} props
 */
export default function AdminTabs({ tabs = [], activeId, onChange, className }) {
  const { t } = useI18n();

  return (
    <div
      role="tablist"
      aria-label={t('admin-foundation.tabs.listAria')}
      className={cn('flex min-w-0 flex-wrap gap-1 border-b border-[var(--admin-border)]', className)}
    >
      {tabs.map((tab) => {
        const selected = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`admin-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={tab.panelId || `admin-tab-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange?.(tab.id)}
            className={cn(
              'min-h-11 px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-focus-ring)]',
              selected
                ? 'border-b-2 border-[var(--admin-accent,#0ea5e9)] text-[var(--admin-text)]'
                : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]'
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
