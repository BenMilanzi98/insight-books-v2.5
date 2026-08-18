'use client';

import { useI18n } from './I18nProvider';
import { cn } from '@/lib/utils';
import { FlagUk, FlagMalawi } from './LocaleFlags';

const OPTIONS = [
  { code: 'en', Flag: FlagUk, label: 'English' },
  { code: 'ny', Flag: FlagMalawi, label: 'Chichewa' },
];

/**
 * Compact dual-flag toggle: both flags visible; inactive is grayed out.
 */
export default function LanguageSwitcher({
  className = '',
  compact = false,
  showLabel = true,
}) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={cn('inline-flex shrink-0 items-center', className)}
      role="group"
      aria-label={t('accessibility.languageSwitcher')}
    >
      {showLabel && !compact ? (
        <span className="sr-only">{t('common.language.label')}</span>
      ) : null}

      <div
        className={cn(
          'inline-flex items-center rounded-full border border-gray-200 bg-gray-100/80 p-0.5 shadow-sm',
          compact ? 'gap-0' : 'gap-0.5'
        )}
        role="radiogroup"
        aria-label={t('common.language.label')}
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
                'inline-flex items-center justify-center rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
                compact ? 'h-6 w-7 p-0.5' : 'h-7 w-8 p-0.5',
                active
                  ? 'bg-white shadow-sm ring-1 ring-gray-200'
                  : 'bg-transparent hover:bg-white/50'
              )}
            >
              <Flag
                title={opt.label}
                className={cn(
                  'rounded-[1px] object-cover ring-1 ring-black/10 transition-[filter,opacity]',
                  compact ? 'h-3 w-[18px]' : 'h-3.5 w-5',
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
