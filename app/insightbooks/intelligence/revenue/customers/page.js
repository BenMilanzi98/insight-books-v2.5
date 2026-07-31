'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { RevenueKpiView } from '@/components/admin';

export default function RevenueCustomersPage() {
  const { t } = useI18n();
  return (
    <RevenueKpiView
      apiPath="/api/admin/intelligence/revenue/customers"
      title={t('admin-pages.revenue.sections.customers')}
      description={t('admin-pages.revenue.sectionHints.customers')}
    />
  );
}
