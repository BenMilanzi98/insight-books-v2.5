'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { ExecutiveKpiView } from '@/components/admin';

export default function ExecutiveOperationsPage() {
  const { t } = useI18n();
  return (
    <ExecutiveKpiView
      section="operations"
      title={t('admin-pages.intelligence.sections.operations')}
      description={t('admin-pages.intelligence.sectionHints.operations')}
      showAttention={false}
    />
  );
}
