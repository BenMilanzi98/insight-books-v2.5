'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { ExecutiveKpiView } from '@/components/admin';

export default function ExecutiveEngagementPage() {
  const { t } = useI18n();
  return (
    <ExecutiveKpiView
      section="engagement"
      title={t('admin-pages.intelligence.sections.engagement')}
      description={t('admin-pages.intelligence.sectionHints.engagement')}
      showAttention={false}
    />
  );
}
