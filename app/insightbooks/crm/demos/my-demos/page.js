'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmMyDemosPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.demosMyDemos"
      hintKey="admin-pages.crm.sectionHints.demosMyDemos"
      emptyTitleKey="admin-pages.crm.demos.emptyTitle"
      emptyHintKey="admin-pages.crm.demos.emptyHint"
    />
  );
}
