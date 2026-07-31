'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { RevenueKpiView } from '@/components/admin';

export default function RevenueRetentionPage() {
  const { t } = useI18n();
  return (
    <RevenueKpiView
      apiPath="/api/admin/intelligence/revenue/retention"
      title={t('admin-pages.revenue.sections.retention')}
      description={t('admin-pages.revenue.sectionHints.retention')}
    />
  );
}
