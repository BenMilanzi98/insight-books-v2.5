'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { ExecutiveKpiView } from '@/components/admin';

export default function ExecutiveSecurityPage() {
  const { t } = useI18n();
  return (
    <ExecutiveKpiView
      section="security"
      title={t('admin-pages.intelligence.sections.security')}
      description={t('admin-pages.intelligence.sectionHints.security')}
      showAttention={false}
    />
  );
}
