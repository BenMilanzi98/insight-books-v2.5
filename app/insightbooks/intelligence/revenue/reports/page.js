'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { RevenueKpiView } from '@/components/admin';

export default function RevenueReportsPage() {
  const { t } = useI18n();
  return (
    <RevenueKpiView
      apiPath="/api/admin/intelligence/revenue/overview"
      showExport
      title={t('admin-pages.revenue.sections.reports')}
      description={t('admin-pages.revenue.sectionHints.reports')}
    />
  );
}
