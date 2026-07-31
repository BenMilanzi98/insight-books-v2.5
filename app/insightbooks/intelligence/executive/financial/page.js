'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { ExecutiveKpiView } from '@/components/admin';

export default function ExecutiveFinancialPage() {
  const { t } = useI18n();
  return (
    <ExecutiveKpiView
      section="financial"
      title={t('admin-pages.intelligence.sections.financial')}
      description={t('admin-pages.intelligence.sectionHints.financial')}
      showAttention={false}
    />
  );
}
