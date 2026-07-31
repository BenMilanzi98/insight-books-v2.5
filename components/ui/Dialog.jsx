'use client';

import { useEffect, useId, useRef } from 'react';
import {
  Dialog as HDialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  DialogDescription,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Button from './Button';

/**
 * Shared modal chrome. Feature content stays in children.
 */
export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  initialFocus,
}) {
  const titleId = useId();
  const closeRef = useRef(null);
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[min(96vw,72rem)]',
  };

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <Transition show={open}>
      <HDialog
        className="relative z-[var(--z-modal)]"
        onClose={onClose}
        initialFocus={initialFocus || closeRef}
      >
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <DialogBackdrop className="fixed inset-0 bg-black/45" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto p-3 sm:p-4">
          <div className="flex min-h-full items-end justify-center sm:items-center">
            <TransitionChild
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-2 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-2 sm:scale-95"
            >
              <DialogPanel
                className={cn(
                  'flex w-full flex-col rounded-[var(--radius-lg)] bg-[var(--surface-primary)] shadow-[var(--shadow-modal)]',
                  'max-h-[min(92vh,900px)] sm:my-8',
                  sizes[size] || sizes.md
                )}
                aria-labelledby={titleId}
              >
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border-default)] px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <DialogTitle
                      id={titleId}
                      className="text-base font-semibold text-[var(--text-primary)] sm:text-lg"
                    >
                      {title}
                    </DialogTitle>
                    {description ? (
                      <DialogDescription className="mt-1 text-sm text-[var(--text-secondary)]">
                        {description}
                      </DialogDescription>
                    ) : null}
                  </div>
                  <Button
                    ref={closeRef}
                    variant="ghost"
                    size="compact"
                    className="min-h-10 min-w-10 px-0"
                    aria-label="Close dialog"
                    onClick={onClose}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
                {footer ? (
                  <div className="shrink-0 border-t border-[var(--border-default)] px-4 py-3 sm:px-5">
                    {footer}
                  </div>
                ) : null}
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </HDialog>
    </Transition>
  );
}

