'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import CrmSectionNav from './CrmSectionNav';

export default function CrmStubView({
  titleKey,
  hintKey,
  emptyTitleKey,
  emptyHintKey,
}) {
  const { t } = useI18n();
  return (
    <AdminPageContainer>
      <AdminPageHeader title={t(titleKey)} description={t(hintKey)} />
      <CrmSectionNav />
      <AdminEmptyState
        title={t(emptyTitleKey)}
        description={t(emptyHintKey)}
      />
    </AdminPageContainer>
  );
}
