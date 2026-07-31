'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Row action menu rendered in a portal so it is never clipped by table overflow.
 */
export default function AdminActionMenu({
  open,
  onOpenChange,
  items = [],
  align = 'end',
  label = 'Actions',
  className,
}) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();
  const [coords, setCoords] = useState({ top: 0, left: 0, openUp: false, ready: false });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return undefined;

    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Hidden duplicate triggers (e.g. CSS-only responsive twins) have a zero box.
      if (rect.width < 1 && rect.height < 1) return;
      const menuWidth = 208;
      const estimatedHeight = Math.min(320, (items.length || 1) * 40 + 16);
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < estimatedHeight && rect.top > spaceBelow;
      let left =
        align === 'end' ? rect.right - menuWidth : rect.left;
      left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
      const top = openUp
        ? Math.max(8, rect.top - estimatedHeight - 4)
        : Math.min(rect.bottom + 4, window.innerHeight - estimatedHeight - 8);
      setCoords({ top, left, openUp, ready: true });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, align, items.length]);

  useEffect(() => {
    if (!open) setCoords((c) => ({ ...c, ready: false }));
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      ) {
        return;
      }
      onOpenChange?.(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onOpenChange?.(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  const menu =
    open && mounted && coords.ready
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            className="fixed z-[var(--z-modal)] w-52 overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg"
            style={{ top: coords.top, left: coords.left }}
          >
            {items.map((item, index) => {
              if (item.separator) {
                return (
                  <div
                    key={item.key || `sep-${index}`}
                    className="my-1 border-t border-[var(--admin-border)]"
                    role="separator"
                  />
                );
              }
              return (
                <button
                  key={item.key || item.label || `item-${index}`}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50',
                    item.tone === 'danger' && 'text-[var(--admin-danger)]'
                  )}
                  onClick={() => {
                    onOpenChange?.(false);
                    item.onSelect?.();
                  }}
                >
                  {item.icon ? <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div className={cn('inline-flex justify-end', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--admin-radius)] text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-focus-ring)]"
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange?.(!open);
        }}
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {menu}
    </div>
  );
}
