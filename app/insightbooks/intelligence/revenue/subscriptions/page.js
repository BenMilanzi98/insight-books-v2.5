'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { RevenueKpiView } from '@/components/admin';

export default function RevenueSubscriptionsPage() {
  const { t } = useI18n();
  return (
    <RevenueKpiView
      apiPath="/api/admin/intelligence/revenue/subscriptions"
      title={t('admin-pages.revenue.sections.subscriptions')}
      description={t('admin-pages.revenue.sectionHints.subscriptions')}
    />
  );
}
