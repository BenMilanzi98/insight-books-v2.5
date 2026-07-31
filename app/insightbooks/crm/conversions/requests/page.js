'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmConversionRequestsPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.conversionRequests"
      hintKey="admin-pages.crm.sectionHints.conversionRequests"
      emptyTitleKey="admin-pages.crm.conversionRequests.emptyTitle"
      emptyHintKey="admin-pages.crm.conversionRequests.emptyHint"
    />
  );
}
