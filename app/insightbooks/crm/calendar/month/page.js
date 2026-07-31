'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmCalendarMonthPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.calendarMonth"
      hintKey="admin-pages.crm.sectionHints.calendar"
      emptyTitleKey="admin-pages.crm.calendar.emptyTitle"
      emptyHintKey="admin-pages.crm.calendar.emptyHint"
    />
  );
}
