'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmDiscountRequestsPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.discountRequests"
      hintKey="admin-pages.crm.sectionHints.discountRequests"
      emptyTitleKey="admin-pages.crm.discountRequests.emptyTitle"
      emptyHintKey="admin-pages.crm.discountRequests.emptyHint"
    />
  );
}
