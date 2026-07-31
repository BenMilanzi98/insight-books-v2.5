'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { ExecutiveKpiView } from '@/components/admin';

export default function ExecutiveSubscriptionsPage() {
  const { t } = useI18n();
  return (
    <ExecutiveKpiView
      section="subscriptions"
      title={t('admin-pages.intelligence.sections.subscriptions')}
      description={t('admin-pages.intelligence.sectionHints.subscriptions')}
      showAttention={false}
    />
  );
}
