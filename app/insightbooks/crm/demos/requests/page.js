'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmDemoRequestsPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.demoRequests"
      hintKey="admin-pages.crm.sectionHints.demoRequests"
      emptyTitleKey="admin-pages.crm.demoRequests.emptyTitle"
      emptyHintKey="admin-pages.crm.demoRequests.emptyHint"
    />
  );
}
