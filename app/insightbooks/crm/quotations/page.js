'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmQuotationsPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.quotations"
      hintKey="admin-pages.crm.sectionHints.quotations"
      emptyTitleKey="admin-pages.crm.quotations.emptyTitle"
      emptyHintKey="admin-pages.crm.quotations.emptyHint"
    />
  );
}
