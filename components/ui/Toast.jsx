'use client';
import { tt } from '@/lib/i18n/runtime';

import { useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Button from './Button';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const tones = {
  success: 'border-l-[var(--status-success)] bg-emerald-50 text-emerald-900',
  error: 'border-l-[var(--status-danger)] bg-red-50 text-red-900',
  warning: 'border-l-[var(--status-warning)] bg-amber-50 text-amber-950',
  info: 'border-l-[var(--status-info)] bg-blue-50 text-blue-900',
};

/**
 * Thin toast adapter for existing local toast state patterns.
 * Pass { show|visible, type, message, detail } from page state.
 */
export default function Toast({
  show,
  visible,
  type = 'info',
  message,
  detail,
  onClose,
  className,
  autoHideMs = 4000,
}) {
  const isOpen = show ?? visible;
  const Icon = icons[type] || icons.info;

  useEffect(() => {
    if (!isOpen || !onClose || !autoHideMs) return undefined;
    const t = setTimeout(onClose, autoHideMs);
    return () => clearTimeout(t);
  }, [isOpen, onClose, autoHideMs]);

  if (!isOpen || !message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-4 right-4 z-[var(--z-toast)] flex max-w-sm items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] border-l-4 p-3 shadow-[var(--shadow-modal)]',
        tones[type] || tones.info,
        className
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{message}</p>
        {detail ? <p className="mt-0.5 text-xs opacity-90">{detail}</p> : null}
      </div>
      {onClose ? (
        <Button
          variant="ghost"
          size="compact"
          className="min-h-8 min-w-8 px-0"
          aria-label={tt('Dismiss')}
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
