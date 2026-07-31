'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmDemoDataPacksPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.demoDataPacks"
      hintKey="admin-pages.crm.sectionHints.demoDataPacks"
      emptyTitleKey="admin-pages.crm.demos.dataPacksEmptyTitle"
      emptyHintKey="admin-pages.crm.demos.dataPacksEmptyHint"
    />
  );
}
