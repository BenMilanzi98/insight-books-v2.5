'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { CustomerStubView } from '@/components/admin';

export default function CustomerSupportPage() {
  const { t } = useI18n();
  return (
    <CustomerStubView
      sectionKey="support"
      emptyTitle={t('admin-pages.customers.notInstrumentedTitle')}
      emptyDescription={t('admin-pages.customers.sectionHints.support')}
    />
  );
}
