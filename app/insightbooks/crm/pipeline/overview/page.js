'use client';

import Link from 'next/link';
import { useI18n } from '@/components/i18n/I18nProvider';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import CrmSectionNav from '@/components/admin/crm/CrmSectionNav';

const linkCls =
  'inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]';

export default function CrmPipelineOverviewPage() {
  const { t } = useI18n();
  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.crm.sections.pipeline')}
        description={t('admin-pages.crm.sectionHints.pipeline')}
      />
      <CrmSectionNav />
      <nav className="mt-4 flex flex-wrap gap-2" aria-label={t('admin-pages.crm.sections.pipeline')}>
        <Link href="/insightbooks/crm/pipeline/board" className={linkCls}>
          {t('admin-pages.crm.sections.pipelineBoard')}
        </Link>
        <Link href="/insightbooks/crm/pipeline/list" className={linkCls}>
          {t('admin-pages.crm.pipeline.listView')}
        </Link>
        <Link href="/insightbooks/crm/pipeline/my-pipeline" className={linkCls}>
          {t('admin-pages.crm.sections.myPipeline')}
        </Link>
        <Link href="/insightbooks/crm/opportunities" className={linkCls}>
          {t('admin-pages.crm.sections.opportunities')}
        </Link>
      </nav>
      <p className="mt-4 text-sm text-[var(--admin-text-muted)]">
        {t('admin-pages.crm.pipeline.weightedDark')}
      </p>
    </AdminPageContainer>
  );
}
