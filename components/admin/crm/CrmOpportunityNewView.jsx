'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import CrmSectionNav from './CrmSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm text-white hover:opacity-90 disabled:opacity-50';
const inputCls =
  'h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-text)]';

export default function CrmOpportunityNewView() {
  const { t } = useI18n();
  const router = useRouter();
  const [leadId, setLeadId] = useState('');
  const [title, setTitle] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const handoffPayload = {
        type: 'CRM_OPPORTUNITY_HANDOFF',
        readinessStatus: 'READY',
        leadId: leadId.trim(),
        idempotencyKey: idempotencyKey.trim() || `ui-create:${leadId.trim()}:${Date.now()}`,
        opportunityId: null,
        opportunityCreated: false,
      };
      const res = await adminFetch('/api/admin/crm/opportunities', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handoffPayload, title: title.trim() || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || t('admin-pages.crm.opportunities.createFailed'));
      }
      const id = body.opportunity?.id;
      if (id) router.push(`/insightbooks/crm/opportunities/${encodeURIComponent(id)}`);
      else router.push('/insightbooks/crm/opportunities');
    } catch (err) {
      setError(err.message || t('admin-pages.crm.opportunities.createFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.crm.opportunities.new')}
        description={t('admin-pages.crm.opportunities.newHint')}
        actions={
          <Link href="/insightbooks/crm/opportunities" className={btnGhost}>
            {t('admin-pages.crm.opportunities.backToList')}
          </Link>
        }
      />
      <CrmSectionNav />

      <form onSubmit={submit} className="mt-4 max-w-lg space-y-3">
        <label className="block text-sm">
          {t('admin-pages.crm.opportunities.leadId')}
          <input
            className={`${inputCls} mt-1`}
            required
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          {t('admin-pages.crm.opportunities.colTitle')}
          <input
            className={`${inputCls} mt-1`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          {t('admin-pages.crm.opportunities.idempotencyKey')}
          <input
            className={`${inputCls} mt-1`}
            value={idempotencyKey}
            onChange={(e) => setIdempotencyKey(e.target.value)}
          />
        </label>
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className={btnPrimary} disabled={busy}>
          {t('admin-pages.crm.opportunities.create')}
        </button>
      </form>
    </AdminPageContainer>
  );
}
