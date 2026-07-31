'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * @param {{ items: { id: string, title: string, content: React.ReactNode }[], className?: string, allowMultiple?: boolean }} props
 */
export default function AdminAccordion({ items = [], className, allowMultiple = false }) {
  const [open, setOpen] = useState(() => new Set());

  const toggle = (id) => {
    setOpen((prev) => {
      const next = new Set(allowMultiple ? prev : []);
      if (prev.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={cn('divide-y divide-[var(--admin-border)] rounded-[var(--admin-radius)] border border-[var(--admin-border)]', className)}>
      {items.map((item) => {
        const expanded = open.has(item.id);
        return (
          <div key={item.id}>
            <h3>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`admin-acc-panel-${item.id}`}
                id={`admin-acc-${item.id}`}
                onClick={() => toggle(item.id)}
                className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]"
              >
                <span>{item.title}</span>
                <ChevronDown
                  className={cn('h-4 w-4 shrink-0 transition-transform', expanded && 'rotate-180')}
                  aria-hidden
                />
              </button>
            </h3>
            {expanded ? (
              <div
                id={`admin-acc-panel-${item.id}`}
                role="region"
                aria-labelledby={`admin-acc-${item.id}`}
                className="px-3 pb-3 text-sm text-[var(--admin-text-muted)]"
              >
                {item.content}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
