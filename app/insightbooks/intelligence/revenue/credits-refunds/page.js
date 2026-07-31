'use client';



import { useI18n } from '@/components/i18n/I18nProvider';

import { RevenueKpiView } from '@/components/admin';



export default function RevenueCreditsRefundsPage() {

  const { t } = useI18n();

  return (

    <RevenueKpiView

      apiPath="/api/admin/intelligence/revenue/credits-refunds"

      title={t('admin-pages.revenue.sections.creditsRefunds')}

      description={t('admin-pages.revenue.sectionHints.creditsRefunds')}

    />

  );

}

