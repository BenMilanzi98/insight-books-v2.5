'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmSettingsPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.settings"
      hintKey="admin-pages.crm.sectionHints.settings"
      emptyTitleKey="admin-pages.crm.stubs.settingsTitle"
      emptyHintKey="admin-pages.crm.stubs.settingsHint"
    />
  );
}
