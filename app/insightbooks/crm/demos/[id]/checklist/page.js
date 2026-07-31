'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmDemoChecklistPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.demoChecklist"
      hintKey="admin-pages.crm.sectionHints.demoChecklist"
      emptyTitleKey="admin-pages.crm.demos.checklistEmptyTitle"
      emptyHintKey="admin-pages.crm.demos.checklistEmptyHint"
    />
  );
}
