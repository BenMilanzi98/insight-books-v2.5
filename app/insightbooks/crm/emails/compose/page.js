'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmEmailComposePage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.emailCompose"
      hintKey="admin-pages.crm.sectionHints.emailCompose"
      emptyTitleKey="admin-pages.crm.emails.composeEmptyTitle"
      emptyHintKey="admin-pages.crm.emails.composeEmptyHint"
    />
  );
}
