'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { RevenueKpiView } from '@/components/admin';

export default function RevenueForecastPage() {
  const { t } = useI18n();
  return (
    <RevenueKpiView
      apiPath="/api/admin/intelligence/revenue/forecast"
      title={t('admin-pages.revenue.sections.forecast')}
      description={t('admin-pages.revenue.sectionHints.forecast')}
    />
  );
}
