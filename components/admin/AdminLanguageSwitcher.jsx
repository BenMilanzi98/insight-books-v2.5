'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { FlagUk, FlagMalawi } from '@/components/i18n/LocaleFlags';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { code: 'en', Flag: FlagUk, label: 'English' },
  { code: 'ny', Flag: FlagMalawi, label: 'Chichewa' },
];

export default function AdminLanguageSwitcher({ className }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={cn('inline-flex shrink-0 items-center', className)}
      role="group"
      aria-label={t('admin-shell.language.label')}
    >
      <span className="sr-only">{t('admin-shell.language.label')}</span>
      <div
        className="inline-flex items-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-muted,#f1f5f9)] p-0.5"
        role="radiogroup"
        aria-label={t('admin-shell.language.label')}
      >
        {OPTIONS.map((opt) => {
          const active = locale === opt.code;
          const Flag = opt.Flag;
          return (
            <button
              key={opt.code}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={opt.label}
              title={opt.label}
              onClick={() => {
                if (!active) void setLocale(opt.code);
              }}
              className={cn(
                'inline-flex h-7 w-8 items-center justify-center rounded-full p-0.5 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-focus-ring)]',
                active
                  ? 'bg-[var(--admin-surface,#fff)] shadow-sm ring-1 ring-[var(--admin-border)]'
                  : 'bg-transparent hover:bg-white/60'
              )}
            >
              <Flag
                title={opt.label}
                className={cn(
                  'h-3.5 w-5 rounded-[1px] ring-1 ring-black/10 transition-[filter,opacity]',
                  active ? 'opacity-100' : 'opacity-40 grayscale'
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
