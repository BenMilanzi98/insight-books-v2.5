'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmCalendarDayPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.calendarDay"
      hintKey="admin-pages.crm.sectionHints.calendar"
      emptyTitleKey="admin-pages.crm.calendar.emptyTitle"
      emptyHintKey="admin-pages.crm.calendar.emptyHint"
    />
  );
}
