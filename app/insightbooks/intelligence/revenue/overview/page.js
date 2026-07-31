'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { RevenueKpiView } from '@/components/admin';

export default function RevenueOverviewPage() {
  const { t } = useI18n();
  return (
    <RevenueKpiView
      endpoint="overview"
      showGroups
      title={t('admin-pages.revenue.title')}
      description={t('admin-pages.revenue.description')}
    />
  );
}
