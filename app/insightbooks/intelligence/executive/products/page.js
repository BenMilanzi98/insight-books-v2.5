'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { ExecutiveKpiView } from '@/components/admin';

export default function ExecutiveProductsPage() {
  const { t } = useI18n();
  return (
    <ExecutiveKpiView
      section="products"
      title={t('admin-pages.intelligence.sections.products')}
      description={t('admin-pages.intelligence.sectionHints.products')}
      showAttention={false}
    />
  );
}
