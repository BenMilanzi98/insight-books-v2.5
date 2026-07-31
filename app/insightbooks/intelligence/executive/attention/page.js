'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { ExecutiveKpiView } from '@/components/admin';

export default function ExecutiveAttentionPage() {
  const { t } = useI18n();
  return (
    <ExecutiveKpiView
      section="attention"
      title={t('admin-pages.intelligence.sections.attention')}
      description={t('admin-pages.intelligence.sectionHints.attention')}
      showAttention={false}
    />
  );
}
