'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { ExecutiveKpiView } from '@/components/admin';

export default function ExecutiveMraEisPage() {
  const { t } = useI18n();
  return (
    <ExecutiveKpiView
      section="mra-eis"
      title={t('admin-pages.intelligence.sections.mraEis')}
      description={t('admin-pages.intelligence.sectionHints.mraEis')}
      showAttention={false}
    />
  );
}
