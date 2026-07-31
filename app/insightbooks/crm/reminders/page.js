'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmRemindersPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.reminders"
      hintKey="admin-pages.crm.sectionHints.reminders"
      emptyTitleKey="admin-pages.crm.reminders.emptyTitle"
      emptyHintKey="admin-pages.crm.reminders.emptyHint"
    />
  );
}
