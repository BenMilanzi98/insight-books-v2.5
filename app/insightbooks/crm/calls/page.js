'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmCallsPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.calls"
      hintKey="admin-pages.crm.sectionHints.calls"
      emptyTitleKey="admin-pages.crm.calls.emptyTitle"
      emptyHintKey="admin-pages.crm.calls.emptyHint"
    />
  );
}
