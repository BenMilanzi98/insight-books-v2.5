'use client';

import { cn } from '@/lib/utils';
import EmptyState from './EmptyState';
import MobileDataCard from './MobileDataCard';

/**
 * Responsive list table: desktop table, mobile stacked cards.
 * columns: [{ key, header, cell?, align?, hideOnMobile? }]
 */
export default function DataTable({
  columns = [],
  rows = [],
  rowKey = 'id',
  emptyTitle = 'No records',
  emptyDescription,
  className,
  onRowClick,
  mobileTitleKey,
}) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="hidden overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-default)] md:block">
        <table className="min-w-full divide-y divide-[var(--border-default)] text-sm">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]',
                    col.align === 'right' && 'text-right',
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)] bg-[var(--surface-primary)]">
            {rows.map((row, idx) => {
              const key = typeof rowKey === 'function' ? rowKey(row, idx) : row[rowKey] ?? idx;
              return (
                <tr
                  key={key}
                  className={cn(
                    'hover:bg-[var(--surface-muted)]/60',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-3 py-3 text-[var(--text-primary)]',
                        col.align === 'right' && 'text-right tabular-nums',
                        col.cellClassName
                      )}
                    >
                      {col.cell ? col.cell(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row, idx) => {
          const key = typeof rowKey === 'function' ? rowKey(row, idx) : row[rowKey] ?? idx;
          const titleCol =
            columns.find((c) => c.key === mobileTitleKey) || columns[0];
          const fields = columns
            .filter((c) => !c.hideOnMobile && c !== titleCol)
            .map((c) => ({
              label: c.header,
              value: c.cell ? c.cell(row) : row[c.key],
            }));
          return (
            <MobileDataCard
              key={key}
              title={titleCol?.cell ? titleCol.cell(row) : row[titleCol?.key]}
              fields={fields}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
