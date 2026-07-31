'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmContactsPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.contacts"
      hintKey="admin-pages.crm.sectionHints.contacts"
      emptyTitleKey="admin-pages.crm.stubs.contactsTitle"
      emptyHintKey="admin-pages.crm.stubs.contactsHint"
    />
  );
}
