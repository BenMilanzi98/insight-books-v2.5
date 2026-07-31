'use client';

import { useEffect } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Button from './Button';

export default function Drawer({
  open,
  onClose,
  title,
  children,
  side = 'right',
  footer,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const fromRight = side === 'right';

  return (
    <Transition show={open}>
      <Dialog className="relative z-[var(--z-modal)]" onClose={onClose}>
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <DialogBackdrop className="fixed inset-0 bg-black/40" />
        </TransitionChild>

        <div className="fixed inset-0 flex">
          <TransitionChild
            enter="transform transition ease-out duration-200"
            enterFrom={fromRight ? 'translate-x-full' : '-translate-x-full'}
            enterTo="translate-x-0"
            leave="transform transition ease-in duration-150"
            leaveFrom="translate-x-0"
            leaveTo={fromRight ? 'translate-x-full' : '-translate-x-full'}
          >
            <DialogPanel
              className={cn(
                'flex h-full w-full max-w-md flex-col bg-[var(--surface-primary)] shadow-[var(--shadow-modal)]',
                fromRight ? 'ml-auto' : 'mr-auto'
              )}
            >
              <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
                <DialogTitle className="text-base font-semibold text-[var(--text-primary)]">
                  {title}
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="compact"
                  className="min-h-10 min-w-10 px-0"
                  aria-label="Close drawer"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
              {footer ? (
                <div className="border-t border-[var(--border-default)] px-4 py-3">{footer}</div>
              ) : null}
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
