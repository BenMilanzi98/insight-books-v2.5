'use client';

import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import AdminEmptyState from './AdminEmptyState';

const MD_QUERY = '(min-width: 768px)';

function subscribeMd(onStoreChange) {
  const mql = window.matchMedia(MD_QUERY);
  mql.addEventListener('change', onStoreChange);
  return () => mql.removeEventListener('change', onStoreChange);
}

function getMdSnapshot() {
  return window.matchMedia(MD_QUERY).matches;
}

function getMdServerSnapshot() {
  return true;
}

/**
 * Desktop table + mobile card list from the same columns/rows.
 * Only one layout is mounted so row actions (portals) are not duplicated.
 */
export default function AdminDataTable({
  columns = [],
  rows = [],
  rowKey = 'id',
  emptyTitle = 'No results',
  emptyDescription,
  onRowClick,
  className,
}) {
  const isDesktop = useSyncExternalStore(subscribeMd, getMdSnapshot, getMdServerSnapshot);

  const getKey = (row, index) => {
    if (typeof rowKey === 'function') return rowKey(row, index);
    return row?.[rowKey] ?? index;
  };

  const visibleMobile = columns.filter((c) => !c.hideOnMobile);

  if (!rows.length) {
    return (
      <AdminEmptyState title={emptyTitle} description={emptyDescription} className={className} />
    );
  }

  if (isDesktop) {
    return (
      <div className={cn('min-w-0', className)}>
        <div className="overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[var(--admin-shadow-card)]">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-[1] bg-gradient-to-r from-sky-50 via-white to-emerald-50 text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn('px-4 py-3 whitespace-nowrap', col.headerClassName)}
                    scope="col"
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={getKey(row, index)}
                  className={cn(
                    'admin-row-reveal border-t border-[var(--admin-border)] transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-[var(--admin-surface-muted)]/80'
                  )}
                  style={{
                    minHeight: 'var(--admin-row-height)',
                    animationDelay: `${Math.min(index, 12) * 30}ms`,
                  }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3 align-middle', col.cellClassName)}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('min-w-0', className)}>
      <ul className="space-y-3">
        {rows.map((row, index) => {
          const body = (
            <dl className="space-y-2">
              {visibleMobile.map((col) => (
                <div key={col.key} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                  <dt className="text-xs font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">
                    {col.mobileLabel || col.header}
                  </dt>
                  <dd className="break-words text-sm text-[var(--admin-text)]">
                    {col.render ? col.render(row) : row[col.key]}
                  </dd>
                </div>
              ))}
            </dl>
          );
          const cardClass =
            'w-full rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-left';
          return (
            <li key={getKey(row, index)}>
              {onRowClick ? (
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  className={cn(cardClass, 'active:bg-[var(--admin-surface-muted)]')}
                >
                  {body}
                </button>
              ) : (
                <div className={cardClass}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
