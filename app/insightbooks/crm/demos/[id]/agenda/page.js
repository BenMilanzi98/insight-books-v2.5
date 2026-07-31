'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmDemoAgendaPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.demoAgenda"
      hintKey="admin-pages.crm.sectionHints.demoAgenda"
      emptyTitleKey="admin-pages.crm.demos.agendaEmptyTitle"
      emptyHintKey="admin-pages.crm.demos.agendaEmptyHint"
    />
  );
}
