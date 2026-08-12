'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DashboardMenuPanel from '@/components/ui/DashboardMenuPanel';

/**
 * Renders a floating panel in a document portal so it is never clipped by
 * overflow:hidden parents (e.g. .tenant-glass-card) or painted under later
 * sibling stacking contexts.
 *
 * variant="dashboard" wraps content in the Dashboard date-menu chrome.
 */
export default function PortalPopover({
  open,
  onClose,
  anchorRef,
  align = 'start',
  className = '',
  style,
  children,
  estimatedWidth = 360,
  estimatedHeight = 280,
  offset = 8,
  zIndex = 'var(--z-popover)',
  variant = 'plain',
  bodyClassName,
}) {
  const panelRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, ready: false });

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !anchorRef?.current) return undefined;

    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 && rect.height < 1) return;

      const panelWidth = Math.min(
        estimatedWidth,
        Math.max(rect.width, panelRef.current?.offsetWidth || estimatedWidth)
      );
      const panelHeight = panelRef.current?.offsetHeight || estimatedHeight;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < panelHeight + offset && rect.top > spaceBelow;

      let left = align === 'end' ? rect.right - panelWidth : rect.left;
      left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));

      const top = openUp
        ? Math.max(8, rect.top - panelHeight - offset)
        : Math.min(rect.bottom + offset, window.innerHeight - 8);

      setCoords({ top, left, ready: true });
    };

    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, align, anchorRef, estimatedWidth, estimatedHeight, offset, children]);

  useEffect(() => {
    if (!open) setCoords((c) => ({ ...c, ready: false }));
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (anchorRef?.current?.contains(e.target) || panelRef.current?.contains(e.target)) {
        return;
      }
      onClose?.();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !mounted) return null;

  const content =
    variant === 'dashboard' ? (
      <DashboardMenuPanel className={className} bodyClassName={bodyClassName}>
        {children}
      </DashboardMenuPanel>
    ) : (
      <div className={className}>{children}</div>
    );

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      style={{
        position: 'fixed',
        top: coords.ready ? coords.top : -9999,
        left: coords.ready ? coords.left : -9999,
        zIndex,
        visibility: coords.ready ? 'visible' : 'hidden',
        ...style,
      }}
    >
      {content}
    </div>,
    document.body
  );
}
