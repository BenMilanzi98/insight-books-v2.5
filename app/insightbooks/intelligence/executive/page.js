'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { ExecutiveKpiView } from '@/components/admin';

export default function ExecutiveIntelligenceOverviewPage() {
  const { t } = useI18n();
  return (
    <ExecutiveKpiView
      title={t('admin-pages.intelligence.title')}
      description={t('admin-pages.intelligence.description')}
      showAttention
    />
  );
}
