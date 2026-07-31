'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmDemoDetailPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.demoDetail"
      hintKey="admin-pages.crm.sectionHints.demoDetail"
      emptyTitleKey="admin-pages.crm.demos.detailEmptyTitle"
      emptyHintKey="admin-pages.crm.demos.detailEmptyHint"
    />
  );
}
