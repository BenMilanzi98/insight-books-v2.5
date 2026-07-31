'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmMeetingsPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.meetings"
      hintKey="admin-pages.crm.sectionHints.meetings"
      emptyTitleKey="admin-pages.crm.meetings.emptyTitle"
      emptyHintKey="admin-pages.crm.meetings.emptyHint"
    />
  );
}
