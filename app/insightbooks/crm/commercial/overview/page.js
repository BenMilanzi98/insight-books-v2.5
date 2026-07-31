'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmCommercialOverviewPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.commercialOverview"
      hintKey="admin-pages.crm.sectionHints.commercialOverview"
      emptyTitleKey="admin-pages.crm.commercialOverview.emptyTitle"
      emptyHintKey="admin-pages.crm.commercialOverview.emptyHint"
    />
  );
}
