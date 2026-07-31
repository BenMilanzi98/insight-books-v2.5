'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmActivityReportsPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.activityReports"
      hintKey="admin-pages.crm.sectionHints.activityReports"
      emptyTitleKey="admin-pages.crm.activityReports.emptyTitle"
      emptyHintKey="admin-pages.crm.activityReports.emptyHint"
    />
  );
}
