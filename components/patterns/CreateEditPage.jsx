import PageContainer from '@/components/shell/PageContainer';
import PageHeader from '@/components/shell/PageHeader';
import Card from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function CreateEditPage({
  title,
  description,
  actions,
  breadcrumb,
  children,
  className,
  narrow = true,
}) {
  return (
    <PageContainer
      variant={narrow ? 'narrow' : 'default'}
      className={cn('pb-8', className)}
    >
      <PageHeader title={title} description={description} actions={actions} breadcrumb={breadcrumb} />
      <Card className="space-y-4">{children}</Card>
    </PageContainer>
  );
}
