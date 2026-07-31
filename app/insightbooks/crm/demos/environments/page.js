'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmDemoEnvironmentsHubPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.demoEnvironments"
      hintKey="admin-pages.crm.sectionHints.demoEnvironments"
      emptyTitleKey="admin-pages.crm.demos.environmentsEmptyTitle"
      emptyHintKey="admin-pages.crm.demos.environmentsEmptyHint"
    />
  );
}
