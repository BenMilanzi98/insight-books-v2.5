'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmDemoScriptPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.demoScript"
      hintKey="admin-pages.crm.sectionHints.demoScript"
      emptyTitleKey="admin-pages.crm.demos.scriptEmptyTitle"
      emptyHintKey="admin-pages.crm.demos.scriptEmptyHint"
    />
  );
}
