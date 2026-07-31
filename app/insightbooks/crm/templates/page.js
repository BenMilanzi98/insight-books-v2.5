'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmActivityTemplatesPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.templates"
      hintKey="admin-pages.crm.sectionHints.templates"
      emptyTitleKey="admin-pages.crm.templates.emptyTitle"
      emptyHintKey="admin-pages.crm.templates.emptyHint"
    />
  );
}
