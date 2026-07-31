'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { RevenueKpiView } from '@/components/admin';

export default function RevenueSegmentsPage() {
  const { t } = useI18n();
  return (
    <RevenueKpiView
      apiPath="/api/admin/intelligence/revenue/segments"
      title={t('admin-pages.revenue.sections.segments')}
      description={t('admin-pages.revenue.sectionHints.segments')}
    />
  );
}
