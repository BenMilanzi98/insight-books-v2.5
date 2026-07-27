'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminStatusBadge,
  AdminField,
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
        <div className="space-y-6">
          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-6">
            <h2 className="text-base font-semibold text-[var(--admin-text)]">Platform</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AdminField label="Application name" required>
                <AdminField.Input
                  value={settings.appName || ''}
                  onChange={(e) => setField('appName', e.target.value)}
                />
              </AdminField>
              <AdminField label="Support email" required>
                <AdminField.Input
                  type="email"
                  value={settings.supportEmail || ''}
                  onChange={(e) => setField('supportEmail', e.target.value)}
                />
              </AdminField>
              <AdminField label="Default currency">
                <AdminField.Input
                  value={settings.defaultCurrency || ''}
                  onChange={(e) => setField('defaultCurrency', e.target.value)}
                />
              </AdminField>
              <AdminField label="Timezone">
                <AdminField.Input
                  value={settings.timezone || ''}
                  onChange={(e) => setField('timezone', e.target.value)}
                />
              </AdminField>
            </div>
          </section>

          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-6">
            <h2 className="text-base font-semibold text-[var(--admin-text)]">Security</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AdminField label="Session timeout (minutes)">
                <AdminField.Input
                  type="number"
                  min={1}
                  max={1440}
                  value={settings.sessionTimeout ?? ''}
                  onChange={(e) => setField('sessionTimeout', Number(e.target.value))}
                />
              </AdminField>
              <AdminField label="Max login attempts">
                <AdminField.Input
                  type="number"
                  min={1}
                  max={20}
                  value={settings.maxLoginAttempts ?? ''}
                  onChange={(e) => setField('maxLoginAttempts', Number(e.target.value))}
                />
              </AdminField>
              <AdminField label="Allowed IPs (comma-separated)" className="sm:col-span-2">
                <AdminField.Input
                  value={settings.allowedIPs || ''}
                  onChange={(e) => setField('allowedIPs', e.target.value)}
                />
              </AdminField>
            </div>
          </section>

          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-6">
            <h2 className="text-base font-semibold text-[var(--admin-text)]">Email</h2>
            <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
              SMTP password shows as {SECRET_MASK} when set. Leave unchanged to keep the stored secret.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AdminField label="SMTP host">
                <AdminField.Input
                  value={settings.smtpHost || ''}
                  onChange={(e) => setField('smtpHost', e.target.value)}
                  autoComplete="off"
                />
              </AdminField>
              <AdminField label="SMTP port">
                <AdminField.Input
                  type="number"
                  value={settings.smtpPort ?? ''}
                  onChange={(e) => setField('smtpPort', Number(e.target.value))}
                />
              </AdminField>
              <AdminField label="SMTP username">
                <AdminField.Input
                  value={settings.smtpUsername || ''}
                  onChange={(e) => setField('smtpUsername', e.target.value)}
                  autoComplete="off"
                />
              </AdminField>
              <AdminField label="SMTP password">
                <AdminField.Input
                  type="password"
                  value={settings.smtpPassword || ''}
                  onChange={(e) => setField('smtpPassword', e.target.value)}
                  autoComplete="new-password"
                  placeholder={SECRET_MASK}
                />
              </AdminField>
              <AdminField label="From email" className="sm:col-span-2">
                <AdminField.Input
                  value={settings.fromEmail || ''}
                  onChange={(e) => setField('fromEmail', e.target.value)}
                />
              </AdminField>
            </div>
          </section>

          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-6">
            <h2 className="text-base font-semibold text-[var(--admin-text)]">Feature flags</h2>
            <ul className="mt-4 space-y-3">
              {Object.keys(featureFlags).map((key) => (
                <li key={key}>
                  <AdminField.Checkbox
                    id={`flag-${key}`}
                    label={key}
                    checked={Boolean(featureFlags[key])}
                    onChange={(e) => setFlag(key, e.target.checked)}
                  />
                </li>
              ))}
              {Object.keys(featureFlags).length === 0 ? (
                <li className="text-sm text-[var(--admin-text-muted)]">No feature flags configured.</li>
              ) : null}
            </ul>
          </section>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
