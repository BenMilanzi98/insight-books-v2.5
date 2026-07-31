'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmDemoAttendancePage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.demoAttendance"
      hintKey="admin-pages.crm.sectionHints.demoAttendance"
      emptyTitleKey="admin-pages.crm.demos.attendanceEmptyTitle"
      emptyHintKey="admin-pages.crm.demos.attendanceEmptyHint"
    />
  );
}
