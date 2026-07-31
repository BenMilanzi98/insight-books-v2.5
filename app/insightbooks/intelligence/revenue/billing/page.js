'use client';



import { useI18n } from '@/components/i18n/I18nProvider';

import { RevenueKpiView } from '@/components/admin';



export default function RevenueBillingPage() {

  const { t } = useI18n();

  return (

    <RevenueKpiView

      apiPath="/api/admin/intelligence/revenue/billing"

      title={t('admin-pages.revenue.sections.billing')}

      description={t('admin-pages.revenue.sectionHints.billing')}

    />

  );

}

