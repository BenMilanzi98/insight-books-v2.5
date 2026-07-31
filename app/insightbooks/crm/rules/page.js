'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmAutomationRulesPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.rules"
      hintKey="admin-pages.crm.sectionHints.rules"
      emptyTitleKey="admin-pages.crm.rules.emptyTitle"
      emptyHintKey="admin-pages.crm.rules.emptyHint"
    />
  );
}
