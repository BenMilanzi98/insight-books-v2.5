'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmActivityDetailPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.activityDetail"
      hintKey="admin-pages.crm.sectionHints.activityDetail"
      emptyTitleKey="admin-pages.crm.activities.detailEmptyTitle"
      emptyHintKey="admin-pages.crm.activities.detailEmptyHint"
    />
  );
}
