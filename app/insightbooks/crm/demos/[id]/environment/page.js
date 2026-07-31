'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmDemoEnvironmentPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.demoEnvironment"
      hintKey="admin-pages.crm.sectionHints.demoEnvironment"
      emptyTitleKey="admin-pages.crm.demos.environmentEmptyTitle"
      emptyHintKey="admin-pages.crm.demos.environmentEmptyHint"
    />
  );
}
