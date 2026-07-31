'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmActivitiesPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.activities"
      hintKey="admin-pages.crm.sectionHints.activities"
      emptyTitleKey="admin-pages.crm.activities.emptyTitle"
      emptyHintKey="admin-pages.crm.activities.emptyHint"
    />
  );
}
