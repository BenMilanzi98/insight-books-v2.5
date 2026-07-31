'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmDemosListPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.demosList"
      hintKey="admin-pages.crm.sectionHints.demosList"
      emptyTitleKey="admin-pages.crm.demos.emptyTitle"
      emptyHintKey="admin-pages.crm.demos.emptyHint"
    />
  );
}
