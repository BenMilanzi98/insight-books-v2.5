'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmAccountsPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.accounts"
      hintKey="admin-pages.crm.sectionHints.accounts"
      emptyTitleKey="admin-pages.crm.stubs.accountsTitle"
      emptyHintKey="admin-pages.crm.stubs.accountsHint"
    />
  );
}
