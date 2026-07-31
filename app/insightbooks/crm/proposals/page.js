'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmProposalsPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.proposals"
      hintKey="admin-pages.crm.sectionHints.proposals"
      emptyTitleKey="admin-pages.crm.proposals.emptyTitle"
      emptyHintKey="admin-pages.crm.proposals.emptyHint"
    />
  );
}
