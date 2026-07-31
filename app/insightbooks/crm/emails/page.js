'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmEmailsPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.emails"
      hintKey="admin-pages.crm.sectionHints.emails"
      emptyTitleKey="admin-pages.crm.emails.emptyTitle"
      emptyHintKey="admin-pages.crm.emails.emptyHint"
    />
  );
}
