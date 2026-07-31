'use client';



import { useI18n } from '@/components/i18n/I18nProvider';

import { RevenueKpiView } from '@/components/admin';



export default function RevenuePaymentPerformancePage() {

  const { t } = useI18n();

  return (

    <RevenueKpiView

      apiPath="/api/admin/intelligence/revenue/payment-performance"

      title={t('admin-pages.revenue.sections.paymentPerformance')}

      description={t('admin-pages.revenue.sectionHints.paymentPerformance')}

    />

  );

}

