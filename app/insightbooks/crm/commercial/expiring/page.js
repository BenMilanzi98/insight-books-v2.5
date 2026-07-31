'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmCommercialExpiringPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.commercialExpiring"
      hintKey="admin-pages.crm.sectionHints.commercialExpiring"
      emptyTitleKey="admin-pages.crm.commercialExpiring.emptyTitle"
      emptyHintKey="admin-pages.crm.commercialExpiring.emptyHint"
    />
  );
}
