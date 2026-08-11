import PageContainer from '@/components/shell/PageContainer';
import PageHeader from '@/components/shell/PageHeader';
import { cn } from '@/lib/utils';

/**
 * Report chrome: title / period / filters / export actions / body.
 */
export default function ReportLayout({
  title,
  description,
  period,
  filters,
  exportActions,
  actions,
  children,
  className,
  variant = 'wide',
}) {
  return (
    <PageContainer variant={variant} className={cn('pb-8', className)}>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {period}
            {exportActions}
            {actions}
          </>
        }
      />
      {filters ? (
        <div className="tenant-glass-card tenant-glass-card--accent mb-4 flex flex-wrap items-end gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-primary)] p-3 sm:p-4">
          {filters}
        </div>
      ) : null}
      <div className="min-w-0 overflow-x-auto">{children}</div>
    </PageContainer>
  );
}
