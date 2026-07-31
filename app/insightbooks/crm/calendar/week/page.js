'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmCalendarWeekPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.calendarWeek"
      hintKey="admin-pages.crm.sectionHints.calendar"
      emptyTitleKey="admin-pages.crm.calendar.emptyTitle"
      emptyHintKey="admin-pages.crm.calendar.emptyHint"
    />
  );
}
