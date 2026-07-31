'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import CustomerSectionNav from './CustomerSectionNav';

/**
 * Thin / matrix-gated Customer Intelligence section page.
 * @param {{
 *   sectionKey: string,
 *   title?: string,
 *   description?: string,
 *   emptyTitle?: string,
 *   emptyDescription?: string,
 * }} props
 */
export default function CustomerStubView({
  sectionKey,
  title,
  description,
  emptyTitle,
  emptyDescription,
}) {
  const { t } = useI18n();
  const resolvedTitle = title || t(`admin-pages.customers.sections.${sectionKey}`);
  const resolvedDescription =
    description || t(`admin-pages.customers.sectionHints.${sectionKey}`);

  return (
    <AdminPageContainer>
      <AdminPageHeader title={resolvedTitle} description={resolvedDescription} />
      <CustomerSectionNav />
      <AdminEmptyState
        title={emptyTitle || t('admin-pages.customers.stubTitle')}
        description={emptyDescription || resolvedDescription}
      />
    </AdminPageContainer>
  );
}
