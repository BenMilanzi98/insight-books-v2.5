'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { RevenueKpiView } from '@/components/admin';

export default function RevenueRecurringPage() {
  const { t } = useI18n();
  return (
    <RevenueKpiView
      endpoint="recurring"
      title={t('admin-pages.revenue.sections.recurring')}
      description={t('admin-pages.revenue.sectionHints.recurring')}
    />
  );
}
