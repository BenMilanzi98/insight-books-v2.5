'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmCommercialReportsPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.commercialReports"
      hintKey="admin-pages.crm.sectionHints.commercialReports"
      emptyTitleKey="admin-pages.crm.commercialReports.emptyTitle"
      emptyHintKey="admin-pages.crm.commercialReports.emptyHint"
    />
  );
}
