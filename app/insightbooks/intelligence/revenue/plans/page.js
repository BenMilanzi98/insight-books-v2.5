'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { RevenueKpiView } from '@/components/admin';

export default function RevenuePlansPage() {
  const { t } = useI18n();
  return (
    <RevenueKpiView
      apiPath="/api/admin/intelligence/revenue/plans"
      title={t('admin-pages.revenue.sections.plans')}
      description={t('admin-pages.revenue.sectionHints.plans')}
    />
  );
}
