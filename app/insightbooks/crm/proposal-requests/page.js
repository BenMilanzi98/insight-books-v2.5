'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmProposalRequestsPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.proposalRequests"
      hintKey="admin-pages.crm.sectionHints.proposalRequests"
      emptyTitleKey="admin-pages.crm.proposalRequests.emptyTitle"
      emptyHintKey="admin-pages.crm.proposalRequests.emptyHint"
    />
  );
}
