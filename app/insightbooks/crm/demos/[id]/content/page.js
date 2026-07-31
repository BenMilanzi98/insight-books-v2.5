'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmDemoContentPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.demoContent"
      hintKey="admin-pages.crm.sectionHints.demoContent"
      emptyTitleKey="admin-pages.crm.demos.contentEmptyTitle"
      emptyHintKey="admin-pages.crm.demos.contentEmptyHint"
    />
  );
}