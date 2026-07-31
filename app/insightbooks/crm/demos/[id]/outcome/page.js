'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmDemoOutcomePage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.demoOutcome"
      hintKey="admin-pages.crm.sectionHints.demoOutcome"
      emptyTitleKey="admin-pages.crm.demos.outcomeEmptyTitle"
      emptyHintKey="admin-pages.crm.demos.outcomeEmptyHint"
    />
  );
}
