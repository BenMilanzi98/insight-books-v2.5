'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { RevenueKpiView } from '@/components/admin';

export default function RevenueCohortsPage() {
  const { t } = useI18n();
  return (
    <RevenueKpiView
      apiPath="/api/admin/intelligence/revenue/cohorts"
      title={t('admin-pages.revenue.sections.cohorts')}
      description={t('admin-pages.revenue.sectionHints.cohorts')}
    />
  );
}
