'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { RevenueKpiView } from '@/components/admin';
import { REVENUE_PAGE_METRIC_CODES } from '@/lib/admin/revenueNav';

export default function RevenueMovementsPage() {
  const { t } = useI18n();
  return (
    <RevenueKpiView
      endpoint="recurring"
      metricCodes={REVENUE_PAGE_METRIC_CODES.movements}
      title={t('admin-pages.revenue.sections.movements')}
      description={t('admin-pages.revenue.sectionHints.movements')}
    />
  );
}
