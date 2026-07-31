import PageContainer from '@/components/shell/PageContainer';
import PageHeader from '@/components/shell/PageHeader';
import { cn } from '@/lib/utils';

export default function DetailPage({
  title,
  description,
  actions,
  status,
  breadcrumb,
  sidebar,
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
      <div className={cn(sidebar && 'grid gap-6 lg:grid-cols-[1fr_20rem]')}>
        <div className="min-w-0">{children}</div>
        {sidebar ? <aside className="min-w-0">{sidebar}</aside> : null}
      </div>
    </PageContainer>
  );
}
