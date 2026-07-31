'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmDemosPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.demos"
      hintKey="admin-pages.crm.sectionHints.demos"
      emptyTitleKey="admin-pages.crm.demos.emptyTitle"
      emptyHintKey="admin-pages.crm.demos.emptyHint"
    />
  );
}
