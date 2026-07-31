'use client';

import { CrmStubView } from '@/components/admin';

export default function CrmTaxRulesPage() {
  return (
    <CrmStubView
      titleKey="admin-pages.crm.sections.taxRules"
      hintKey="admin-pages.crm.sectionHints.taxRules"
      emptyTitleKey="admin-pages.crm.taxRules.emptyTitle"
      emptyHintKey="admin-pages.crm.taxRules.emptyHint"
    />
  );
}
