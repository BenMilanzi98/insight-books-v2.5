'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmTasksPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.tasks"
      hintKey="admin-pages.crm.sectionHints.tasks"
      emptyTitleKey="admin-pages.crm.tasks.emptyTitle"
      emptyHintKey="admin-pages.crm.tasks.emptyHint"
    />
  );
}
