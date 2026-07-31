'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmDemoReportsPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.demoReports"
      hintKey="admin-pages.crm.sectionHints.demoReports"
      emptyTitleKey="admin-pages.crm.demos.reportsEmptyTitle"
      emptyHintKey="admin-pages.crm.demos.reportsEmptyHint"
    />
  );
}
