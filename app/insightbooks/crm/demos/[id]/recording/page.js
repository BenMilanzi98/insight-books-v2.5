'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmDemoRecordingPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.demoRecording"
      hintKey="admin-pages.crm.sectionHints.demoRecording"
      emptyTitleKey="admin-pages.crm.demos.recordingEmptyTitle"
      emptyHintKey="admin-pages.crm.demos.recordingEmptyHint"
    />
  );
}
