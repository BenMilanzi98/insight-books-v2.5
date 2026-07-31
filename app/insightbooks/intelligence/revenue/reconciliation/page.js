'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { RevenueKpiView } from '@/components/admin';

export default function RevenueReconciliationPage() {
  const { t } = useI18n();
  return (
    <RevenueKpiView
      endpoint="reconciliation"
      title={t('admin-pages.revenue.sections.reconciliation')}
      description={t('admin-pages.revenue.sectionHints.reconciliation')}
    />
  );
}
