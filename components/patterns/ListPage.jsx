import PageContainer from '@/components/shell/PageContainer';
import PageHeader from '@/components/shell/PageHeader';
import { cn } from '@/lib/utils';

/**
 * List page composition: header + optional filters + content region.
 */
export default function ListPage({
  title,
  description,
  actions,
  status,
  breadcrumb,
  filters,
  children,
  className,
  variant = 'default',
}) {
  return (
    <PageContainer variant={variant} className={cn('pb-8', className)}>
      <PageHeader
        title={title}
        description={description}
        actions={actions}
        status={status}
        breadcrumb={breadcrumb}
      />
      {filters ? <div className="mb-4">{filters}</div> : null}
      {children}
    </PageContainer>
  );
}
