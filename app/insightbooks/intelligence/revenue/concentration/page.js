'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { RevenueKpiView } from '@/components/admin';

export default function RevenueConcentrationPage() {
  const { t } = useI18n();
  return (
    <RevenueKpiView
      apiPath="/api/admin/intelligence/revenue/concentration"
      title={t('admin-pages.revenue.sections.concentration')}
      description={t('admin-pages.revenue.sectionHints.concentration')}
    />
  );
}
