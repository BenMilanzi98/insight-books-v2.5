'use client';



import { useI18n } from '@/components/i18n/I18nProvider';

import { RevenueKpiView } from '@/components/admin';



export default function RevenueCollectionsPage() {

  const { t } = useI18n();

  return (

    <RevenueKpiView

      apiPath="/api/admin/intelligence/revenue/collections"

      title={t('admin-pages.revenue.sections.collections')}

      description={t('admin-pages.revenue.sectionHints.collections')}

    />

  );

}

