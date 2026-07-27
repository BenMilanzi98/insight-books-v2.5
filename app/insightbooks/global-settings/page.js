'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminStatusBadge,
} from '@/components/admin';
import { SECRET_MASK } from '@/lib/admin/platformSettings';

const EMPTY = {
  appName: '',
  supportEmail: '',
  defaultCurrency: 'MWK',
  timezone: 'Africa/Blantyre',
  sessionTimeout: 480,
  maxLoginAttempts: 5,
  allowedIPs: '',
  smtpHost: '',
  smtpPort: 465,
  smtpUsername: '',
  smtpPassword: '',
  fromEmail: '',
  adminNotificationEmail: '',
};

export default function AdminGlobalSettingsPage() {
  const [settings, setSettings] = useState(EMPTY);
  const [featureFlags, setFeatureFlags] = useState({});
  const [version, setVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/settings', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed to load (${res.status})`);
      setSettings({ ...EMPTY, ...(body.settings || {}) });
      setFeatureFlags(body.featureFlags || {});
      setVersion(body.version ?? null);
    } catch (e) {
      setError(e.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSuccess('');
  };

  const setFlag = (key, value) => {
    setFeatureFlags((prev) => ({ ...prev, [key]: value }));
    setSuccess('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, featureFlags }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Save failed (${res.status})`);
      setSettings({ ...EMPTY, ...(body.settings || {}) });
      setFeatureFlags(body.featureFlags || {});
      setVersion(body.version ?? null);
      setSuccess('Settings saved. Secrets were not returned in clear text.');
    } catch (e) {
      setError(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageContainer maxWidth="narrow">
      <AdminPageHeader
        title="Global Settings"
        description="Platform configuration. Secret fields are masked; leave masked or blank to keep the existing value."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-sm"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Reload
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--action-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              <Save className="h-4 w-4" aria-hidden />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        }
      />

      {version != null ? (
        <p className="mb-4 text-xs text-[var(--text-muted)]">
          Settings version <AdminStatusBadge tone="info">v{version}</AdminStatusBadge>
        </p>
      ) : null}

      {loading ? <AdminLoadingState label="Loading settings" /> : null}
      {!loading && error ? (
        <AdminErrorState title="Settings unavailable" message={error} onRetry={load} />
      ) : null}
      {success ? (
        <p className="mb-4 rounded-[var(--radius-md)] bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          {success}
        </p>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-8">
          <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-primary)] p-4 sm:p-6">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Platform</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Application name" required>
                <input
                  className="input"
                  value={settings.appName || ''}
                  onChange={(e) => setField('appName', e.target.value)}
                />
              </Field>
              <Field label="Support email" required>
                <input
                  className="input"
                  type="email"
                  value={settings.supportEmail || ''}
                  onChange={(e) => setField('supportEmail', e.target.value)}
                />
              </Field>
              <Field label="Default currency">
                <input
                  className="input"
                  value={settings.defaultCurrency || ''}
                  onChange={(e) => setField('defaultCurrency', e.target.value)}
                />
              </Field>
              <Field label="Timezone">
                <input
                  className="input"
                  value={settings.timezone || ''}
                  onChange={(e) => setField('timezone', e.target.value)}
                />
              </Field>
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-primary)] p-4 sm:p-6">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Security</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Session timeout (minutes)">
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={1440}
                  value={settings.sessionTimeout ?? ''}
                  onChange={(e) => setField('sessionTimeout', Number(e.target.value))}
                />
              </Field>
              <Field label="Max login attempts">
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={20}
                  value={settings.maxLoginAttempts ?? ''}
                  onChange={(e) => setField('maxLoginAttempts', Number(e.target.value))}
                />
              </Field>
              <Field label="Allowed IPs (comma-separated)" className="sm:col-span-2">
                <input
                  className="input"
                  value={settings.allowedIPs || ''}
                  onChange={(e) => setField('allowedIPs', e.target.value)}
                />
              </Field>
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-primary)] p-4 sm:p-6">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Email</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              SMTP password shows as {SECRET_MASK} when set. Leave unchanged to keep the stored secret.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="SMTP host">
                <input
                  className="input"
                  value={settings.smtpHost || ''}
                  onChange={(e) => setField('smtpHost', e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field label="SMTP port">
                <input
                  className="input"
                  type="number"
                  value={settings.smtpPort ?? ''}
                  onChange={(e) => setField('smtpPort', Number(e.target.value))}
                />
              </Field>
              <Field label="SMTP username">
                <input
                  className="input"
                  value={settings.smtpUsername || ''}
                  onChange={(e) => setField('smtpUsername', e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field label="SMTP password">
                <input
                  className="input"
                  type="password"
                  value={settings.smtpPassword || ''}
                  onChange={(e) => setField('smtpPassword', e.target.value)}
                  autoComplete="new-password"
                  placeholder={SECRET_MASK}
                />
              </Field>
              <Field label="From email" className="sm:col-span-2">
                <input
                  className="input"
                  value={settings.fromEmail || ''}
                  onChange={(e) => setField('fromEmail', e.target.value)}
                />
              </Field>
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-primary)] p-4 sm:p-6">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Feature flags</h2>
            <ul className="mt-4 space-y-3">
              {Object.keys(featureFlags).map((key) => (
                <li key={key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-[var(--text-secondary)]">{key}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(featureFlags[key])}
                    onChange={(e) => setFlag(key, e.target.checked)}
                    aria-label={key}
                  />
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          background: var(--surface-primary);
          color: var(--text-primary);
        }
      `}</style>
    </AdminPageContainer>
  );
}

function Field({ label, required, children, className = '' }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-[var(--text-secondary)]">
        {label}
        {required ? <span className="text-[var(--status-danger)]"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
