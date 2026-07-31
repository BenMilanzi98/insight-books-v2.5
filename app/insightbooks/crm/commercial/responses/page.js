'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmCommercialResponsesPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.commercialResponses"
      hintKey="admin-pages.crm.sectionHints.commercialResponses"
      emptyTitleKey="admin-pages.crm.commercialResponses.emptyTitle"
      emptyHintKey="admin-pages.crm.commercialResponses.emptyHint"
    />
  );
}
