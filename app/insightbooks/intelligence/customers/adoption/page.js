'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { CustomerStubView } from '@/components/admin';

export default function CustomerAdoptionPage() {
  const { t } = useI18n();
  return (
    <CustomerStubView
      sectionKey="adoption"
      emptyTitle={t('admin-pages.customers.unavailableTitle')}
      emptyDescription={t('admin-pages.customers.sectionHints.adoption')}
    />
  );
}
