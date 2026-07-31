'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { ExecutiveKpiView } from '@/components/admin';

export default function ExecutiveReportsPage() {
  const { t } = useI18n();
  return (
    <ExecutiveKpiView
      section="reports"
      title={t('admin-pages.intelligence.sections.reports')}
      description={t('admin-pages.intelligence.sectionHints.reports')}
      showAttention={false}
      showExport
    />
  );
}
