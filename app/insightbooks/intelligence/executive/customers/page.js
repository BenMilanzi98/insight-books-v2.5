'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { ExecutiveKpiView } from '@/components/admin';

export default function ExecutiveCustomersPage() {
  const { t } = useI18n();
  return (
    <ExecutiveKpiView
      section="customers"
      title={t('admin-pages.intelligence.sections.customers')}
      description={t('admin-pages.intelligence.sectionHints.customers')}
      showAttention={false}
    />
  );
}
