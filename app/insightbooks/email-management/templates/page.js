'use client';
import { tt } from '@/lib/i18n/runtime';

import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminEmptyState,
  AdminStatusBadge,
  AdminDataTable,
  AdminModal,
  AdminField,
} from '@/components/admin';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white disabled:opacity-50';

export default function EmailTemplatesPage() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    subject: '',
    bodyHtml: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/email/templates', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to load templates');
      setTemplates(body.templates || []);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/email/templates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Save failed');
      setShowForm(false);
      setForm({ code: '', name: '', subject: '', bodyHtml: '' });
      await load();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'code',
        header: 'Code',
        render: (t) => <span className="font-mono text-xs text-[var(--admin-text)]">{t.code}</span>,
      },
      {
        key: 'name',
        header: 'Name',
        render: (t) => <span className="text-[var(--admin-text)]">{t.name}</span>,
      },
      {
        key: 'version',
        header: 'Version',
        render: (t) => `v${t.version}`,
      },
      {
        key: 'subject',
        header: 'Subject',
        render: (t) => (
          <span className="max-w-xs truncate text-[var(--admin-text-muted)]">{t.subject}</span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (t) => (
          <AdminStatusBadge tone={t.status === 'ACTIVE' ? tt('success') : tt('neutral')}>
            {t.status}
          </AdminStatusBadge>
        ),
      },
    ],
    []
  );

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.email.templates.title')}
        description="Versioned templates. SMTP secrets are never stored here — configure transport under Global Settings."
        actions={
          <>
            <button type="button" onClick={load} className={btnGhost}>
              <RefreshCw className="h-4 w-4" aria-hidden /> {tt('Refresh')}
            </button>
            <button type="button" onClick={() => setShowForm(true)} className={btnPrimary}>
              <Plus className="h-4 w-4" aria-hidden /> {tt('New version')}
            </button>
          </>
        }
      />

      {loading ? <AdminLoadingState label="Loading templates" /> : null}
      {!loading && error && templates.length === 0 ? (
        <AdminErrorState message={error} onRetry={load} />
      ) : null}
      {!loading && !error && templates.length === 0 ? (
        <AdminEmptyState title={tt('No templates')} description="Create a versioned template to get started." />
      ) : null}
      {!loading && templates.length > 0 ? (
        <AdminDataTable columns={columns} rows={templates} rowKey="id" />
      ) : null}

      <AdminModal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={tt('New template version')}
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setShowForm(false)} className={btnGhost}>
              {tt('Cancel')}
            </button>
            <button type="submit" form="email-template-form" disabled={saving} className={btnPrimary}>
              {saving ? tt('Saving…') : tt('Save version')}
            </button>
          </>
        }
      >
        <form id="email-template-form" onSubmit={save} className="space-y-3">
          <AdminField label="Code" htmlFor="tpl-code" required>
            <AdminField.Input
              id="tpl-code"
              required
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
            />
          </AdminField>
          <AdminField label="Name" htmlFor="tpl-name" required>
            <AdminField.Input
              id="tpl-name"
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </AdminField>
          <AdminField label="Subject" htmlFor="tpl-subject" required>
            <AdminField.Input
              id="tpl-subject"
              required
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
            />
          </AdminField>
          <AdminField label="HTML body" htmlFor="tpl-body" required>
            <AdminField.Textarea
              id="tpl-body"
              required
              rows={6}
              className="font-mono text-xs"
              value={form.bodyHtml}
              onChange={(e) => setForm((p) => ({ ...p, bodyHtml: e.target.value }))}
            />
          </AdminField>
        </form>
      </AdminModal>
    </AdminPageContainer>
  );
}
