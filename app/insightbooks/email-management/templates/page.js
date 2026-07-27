'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminEmptyState,
  AdminStatusBadge,
} from '@/components/admin';

export default function EmailTemplatesPage() {
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
      const res = await fetch('/api/admin/email/templates', { credentials: 'include' });
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
      const res = await fetch('/api/admin/email/templates', {
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

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Email templates"
        description="Versioned templates. SMTP secrets are never stored here — configure transport under Global Settings."
        actions={
          <>
            <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded bg-[var(--action-primary)] px-3 py-2 text-sm text-white"
            >
              <Plus className="h-4 w-4" /> New version
            </button>
          </>
        }
      />

      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && templates.length === 0 ? (
        <AdminEmptyState title="No templates" description="Create a versioned template to get started." />
      ) : null}

      {!loading && !error && templates.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">{t.code}</td>
                  <td className="px-4 py-3">{t.name}</td>
                  <td className="px-4 py-3">v{t.version}</td>
                  <td className="max-w-xs truncate px-4 py-3">{t.subject}</td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge tone={t.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {t.status}
                    </AdminStatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {showForm ? (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <form onSubmit={save} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-lg">
            <h2 className="text-lg font-semibold">New template version</h2>
            {['code', 'name', 'subject'].map((key) => (
              <label key={key} className="mt-3 block text-sm">
                <span className="mb-1 block font-medium capitalize">{key}</span>
                <input
                  required
                  className="w-full rounded border px-3 py-2"
                  value={form[key]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                />
              </label>
            ))}
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium">HTML body</span>
              <textarea
                required
                rows={6}
                className="w-full rounded border px-3 py-2 font-mono text-xs"
                value={form.bodyHtml}
                onChange={(e) => setForm((p) => ({ ...p, bodyHtml: e.target.value }))}
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded border px-3 py-2 text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-[var(--action-primary)] px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save version'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
