'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmDemoDeliveryPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.demoDelivery"
      hintKey="admin-pages.crm.sectionHints.demoDelivery"
      emptyTitleKey="admin-pages.crm.demos.deliveryEmptyTitle"
      emptyHintKey="admin-pages.crm.demos.deliveryEmptyHint"
    />
  );
}
