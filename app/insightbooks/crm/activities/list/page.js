'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmActivitiesListPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.activitiesList"
      hintKey="admin-pages.crm.sectionHints.activitiesList"
      emptyTitleKey="admin-pages.crm.activities.emptyTitle"
      emptyHintKey="admin-pages.crm.activities.emptyHint"
    />
  );
}
