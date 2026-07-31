'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { RevenueKpiView } from '@/components/admin';
import { REVENUE_PAGE_METRIC_CODES } from '@/lib/admin/revenueNav';

export default function RevenueArrPage() {
  const { t } = useI18n();
  return (
    <RevenueKpiView
      endpoint="recurring"
      metricCodes={REVENUE_PAGE_METRIC_CODES.arr}
      title={t('admin-pages.revenue.sections.arr')}
      description={t('admin-pages.revenue.sectionHints.arr')}
    />
  );
}
