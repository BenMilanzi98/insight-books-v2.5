'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import ProductAnalyticsSectionNav from './ProductAnalyticsSectionNav';

/**
 * Matrix-gated Product Analytics section page (Wave 4 depth deferred).
 */
export default function ProductAnalyticsStubView({
  sectionKey,
  title,
  description,
  emptyTitle,
  emptyDescription,
  status = 'NOT_INSTRUMENTED',
}) {
  const { t } = useI18n();
  const resolvedTitle =
    title || t(`admin-pages.productAnalytics.sections.${sectionKey}`);
  const resolvedDescription =
    description || t(`admin-pages.productAnalytics.sectionHints.${sectionKey}`);

  return (
    <AdminPageContainer>
      <AdminPageHeader title={resolvedTitle} description={resolvedDescription} />
      <ProductAnalyticsSectionNav />
      <div className="mb-3">
        <AdminStatusBadge tone="danger">{status}</AdminStatusBadge>
      </div>
      <AdminEmptyState
        title={emptyTitle || t('admin-pages.productAnalytics.stubTitle')}
        description={emptyDescription || resolvedDescription}
      />
    </AdminPageContainer>
  );
}
