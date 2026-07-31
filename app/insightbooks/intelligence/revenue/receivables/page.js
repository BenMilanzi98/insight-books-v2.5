'use client';



import { useI18n } from '@/components/i18n/I18nProvider';

import { RevenueKpiView } from '@/components/admin';



export default function RevenueReceivablesPage() {

  const { t } = useI18n();

  return (

    <RevenueKpiView

      apiPath="/api/admin/intelligence/revenue/receivables"

      title={t('admin-pages.revenue.sections.receivables')}

      description={t('admin-pages.revenue.sectionHints.receivables')}

    />

  );

}

