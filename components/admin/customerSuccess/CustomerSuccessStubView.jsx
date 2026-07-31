'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import CustomerSuccessSectionNav from './CustomerSuccessSectionNav';

/**
 * Matrix-gated CS section stub (Wave 3/4 engines not built here).
 */
export default function CustomerSuccessStubView({
  sectionKey,
  readiness = 'stub',
  title,
  description,
  emptyTitle,
  emptyDescription,
}) {
  const { t } = useI18n();
  const resolvedTitle = title || t(`admin-pages.customerSuccess.sections.${sectionKey}`);
  const resolvedDescription =
    description || t(`admin-pages.customerSuccess.sectionHints.${sectionKey}`);
  const isUnavailable = readiness === 'unavailable';

  return (
    <AdminPageContainer>
      <AdminPageHeader title={resolvedTitle} description={resolvedDescription} />
      <CustomerSuccessSectionNav />
      <AdminEmptyState
        title={
          emptyTitle ||
          (isUnavailable
            ? t('admin-pages.customerSuccess.unavailableTitle')
            : t('admin-pages.customerSuccess.stubTitle'))
        }
        description={
          emptyDescription ||
          (isUnavailable
            ? t('admin-pages.customerSuccess.unavailableHint')
            : t('admin-pages.customerSuccess.stubHint'))
        }
      />
    </AdminPageContainer>
  );
}
