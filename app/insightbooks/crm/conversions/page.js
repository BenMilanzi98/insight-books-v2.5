'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmConversionsPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.conversions"
      hintKey="admin-pages.crm.sectionHints.conversions"
      emptyTitleKey="admin-pages.crm.conversions.emptyTitle"
      emptyHintKey="admin-pages.crm.conversions.emptyHint"
    />
  );
}
