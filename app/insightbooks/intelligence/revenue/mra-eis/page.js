'use client';



import { useI18n } from '@/components/i18n/I18nProvider';

import { RevenueKpiView } from '@/components/admin';



export default function RevenueMraEisPage() {

  const { t } = useI18n();

  return (

    <RevenueKpiView

      apiPath="/api/admin/intelligence/revenue/mra-eis"

      title={t('admin-pages.revenue.sections.mraEis')}

      description={t('admin-pages.revenue.sectionHints.mraEis')}

    />

  );

}

