'use client';
import { tt } from '@/lib/i18n/runtime';

import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle, Clock, Lock, Plus, RefreshCw, Save,
  Shield, Smartphone, Trash2, User,
} from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminEmptyState,
  AdminStatusBadge,
  AdminField,
} from '@/components/admin';

const DEFAULT_SETTINGS = {
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAge: 90,
  },
  mfaSettings: {
    enabled: true,
    requireForAdmins: true,
    requireForUsers: false,
    allowedMethods: ['totp', 'sms', 'email'],
  },
  sessionSettings: {
    maxSessionDuration: 24,
    idleTimeout: 30,
    maxConcurrentSessions: 3,
    requireReauthForSensitive: true,
  },
  securityFeatures: {
    rateLimiting: true,
    ipWhitelist: false,
    suspiciousActivityDetection: true,
    auditLogging: true,
  },
};

const btnGhost = 'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary = 'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white disabled:opacity-50';

function Section({ title, icon: Icon, children }) {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--admin-border)] px-4 py-3 sm:px-6">
        {Icon ? <Icon className="h-5 w-5 text-[var(--admin-text-muted)]" aria-hidden /> : null}
        <h2 className="text-base font-semibold text-[var(--admin-text)]">{title}</h2>
      </div>
      <div className="space-y-4 p-4 sm:p-6">{children}</div>
    </section>
  );
}

export default function SecurityPage() {
  const { t } = useI18n();
  const [securitySettings, setSecuritySettings] = useState(DEFAULT_SETTINGS);
  const [activeSessions, setActiveSessions] = useState([]);
  const [sessionsError, setSessionsError] = useState('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [newIpAddress, setNewIpAddress] = useState('');
  const [whitelistedIPs, setWhitelistedIPs] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setSessionsError('');
    try {
      const [settingsRes, sessionsRes] = await Promise.all([
        adminFetch('/api/admin/security/settings', { credentials: 'include' }),
        adminFetch('/api/admin/security/sessions', { credentials: 'include' }),
      ]);

      if (settingsRes.ok) {
        const settings = await settingsRes.json().catch(() => ({}));
        if (settings.settings) {
          setSecuritySettings((prev) => ({ ...prev, ...settings.settings }));
          if (Array.isArray(settings.settings.whitelistedIPs)) {
            setWhitelistedIPs(settings.settings.whitelistedIPs);
          } else if (Array.isArray(settings.whitelistedIPs)) {
            setWhitelistedIPs(settings.whitelistedIPs);
          }
        }
        setSettingsLoaded(true);
      }

      if (sessionsRes.ok) {
        const sessions = await sessionsRes.json().catch(() => ({}));
        setActiveSessions(Array.isArray(sessions.sessions) ? sessions.sessions : []);
      } else {
        setActiveSessions([]);
        const body = await sessionsRes.json().catch(() => ({}));
        setSessionsError(body.error || `Sessions unavailable (${sessionsRes.status})`);
      }
    } catch (err) {
      setActiveSessions([]);
      setSessionsError(err.message || 'Failed to load security data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveStatus('');
    try {
      const res = await adminFetch('/api/admin/security/settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            ...securitySettings,
            whitelistedIPs,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus(
          data?.error
          || (res.status === 401
            ? 'You must be signed in to save security settings.'
            : res.status === 403
              ? 'You do not have permission to change security settings.'
              : `Settings could not be saved (${res.status}).`)
        );
      }
    } catch (err) {
      setSaveStatus(err.message || 'Network or server error.');
    } finally {
      setSaving(false);
    }
  };

  const handleTerminateSession = async (sessionId) => {
    try {
      const res = await adminFetch(`/api/admin/security/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setActiveSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
    } catch {
      // keep list; user can refresh
    }
  };

  const addWhitelistedIP = () => {
    const ip = newIpAddress.trim();
    if (ip && !whitelistedIPs.includes(ip)) {
      setWhitelistedIPs((prev) => [...prev, ip]);
      setNewIpAddress('');
    }
  };

  const sessionTone = (session) => {
    if (!session?.lastActivity) return 'neutral';
    const idleMinutes = Math.floor((Date.now() - new Date(session.lastActivity).getTime()) / 60000);
    if (idleMinutes > (securitySettings.sessionSettings?.idleTimeout || 30)) return 'warning';
    return 'success';
  };

  if (loading) {
    return (
      <AdminPageContainer>
        <AdminPageHeader
          title={t('admin-pages.security.title')}
          description="Configure password policy, MFA, sessions, and platform security features."
        />
        <AdminLoadingState label="Loading security settings" />
      </AdminPageContainer>
    );
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.security.title')}
        description="Configure password policy, MFA, sessions, and platform security features."
        actions={
          <>
            <button type="button" onClick={load} className={btnGhost}>
              <RefreshCw className="h-4 w-4" aria-hidden /> {tt('Refresh')}
            </button>
            <button type="button" onClick={handleSaveSettings} disabled={saving} className={btnPrimary}>
              <Save className="h-4 w-4" aria-hidden />
              {saving ? tt('Saving…') : tt('Save settings')}
            </button>
          </>
        }
      />

      {saveStatus ? (
        <div
          className={`mb-4 flex items-start gap-3 rounded-[var(--admin-radius)] border px-4 py-3 text-sm ${
            saveStatus === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
          role="status"
        >
          {saveStatus === 'success' ? (
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          )}
          <p>{saveStatus === 'success' ? 'Settings saved successfully.' : saveStatus}</p>
        </div>
      ) : null}

      {!settingsLoaded ? (
        <div className="mb-4">
          <AdminErrorState
            title={tt('Settings could not be loaded')}
            message="Showing local defaults until the security settings API responds. Save may still fail if the endpoint is unavailable."
            onRetry={load}
          />
        </div>
      ) : null}

      <div className="space-y-6">
        <Section title={tt('Password policy')} icon={Lock}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <AdminField label="Minimum length" htmlFor="pw-min">
              <AdminField.Input
                id="pw-min"
                type="number"
                min={6}
                max={32}
                value={securitySettings.passwordPolicy.minLength}
                onChange={(e) => setSecuritySettings((prev) => ({
                  ...prev,
                  passwordPolicy: { ...prev.passwordPolicy, minLength: parseInt(e.target.value, 10) || 8 },
                }))}
              />
            </AdminField>
            <AdminField label="Maximum age (days)" htmlFor="pw-age">
              <AdminField.Input
                id="pw-age"
                type="number"
                min={30}
                max={365}
                value={securitySettings.passwordPolicy.maxAge}
                onChange={(e) => setSecuritySettings((prev) => ({
                  ...prev,
                  passwordPolicy: { ...prev.passwordPolicy, maxAge: parseInt(e.target.value, 10) || 90 },
                }))}
              />
            </AdminField>
          </div>
          <div className="space-y-2">
            {[
              ['requireUppercase', 'Require uppercase letters'],
              ['requireLowercase', 'Require lowercase letters'],
              ['requireNumbers', 'Require numbers'],
              ['requireSpecialChars', 'Require special characters'],
            ].map(([key, label]) => (
              <AdminField.Checkbox
                key={key}
                id={`pw-${key}`}
                label={label}
                checked={Boolean(securitySettings.passwordPolicy[key])}
                onChange={(e) => setSecuritySettings((prev) => ({
                  ...prev,
                  passwordPolicy: { ...prev.passwordPolicy, [key]: e.target.checked },
                }))}
              />
            ))}
          </div>
        </Section>

        <Section title={tt('Multi-factor authentication')} icon={Smartphone}>
          <div className="space-y-2">
            <AdminField.Checkbox
              id="mfa-enabled"
              label="Enable MFA"
              checked={Boolean(securitySettings.mfaSettings.enabled)}
              onChange={(e) => setSecuritySettings((prev) => ({
                ...prev,
                mfaSettings: { ...prev.mfaSettings, enabled: e.target.checked },
              }))}
            />
            <AdminField.Checkbox
              id="mfa-admins"
              label="Require MFA for admins"
              checked={Boolean(securitySettings.mfaSettings.requireForAdmins)}
              onChange={(e) => setSecuritySettings((prev) => ({
                ...prev,
                mfaSettings: { ...prev.mfaSettings, requireForAdmins: e.target.checked },
              }))}
            />
            <AdminField.Checkbox
              id="mfa-users"
              label="Require MFA for users"
              checked={Boolean(securitySettings.mfaSettings.requireForUsers)}
              onChange={(e) => setSecuritySettings((prev) => ({
                ...prev,
                mfaSettings: { ...prev.mfaSettings, requireForUsers: e.target.checked },
              }))}
            />
          </div>
        </Section>

        <Section title={tt('Session settings')} icon={Clock}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AdminField label="Max session duration (hours)" htmlFor="sess-max">
              <AdminField.Input
                id="sess-max"
                type="number"
                min={1}
                max={168}
                value={securitySettings.sessionSettings.maxSessionDuration}
                onChange={(e) => setSecuritySettings((prev) => ({
                  ...prev,
                  sessionSettings: {
                    ...prev.sessionSettings,
                    maxSessionDuration: parseInt(e.target.value, 10) || 24,
                  },
                }))}
              />
            </AdminField>
            <AdminField label="Idle timeout (minutes)" htmlFor="sess-idle">
              <AdminField.Input
                id="sess-idle"
                type="number"
                min={5}
                max={120}
                value={securitySettings.sessionSettings.idleTimeout}
                onChange={(e) => setSecuritySettings((prev) => ({
                  ...prev,
                  sessionSettings: {
                    ...prev.sessionSettings,
                    idleTimeout: parseInt(e.target.value, 10) || 30,
                  },
                }))}
              />
            </AdminField>
            <AdminField label="Max concurrent sessions" htmlFor="sess-conc">
              <AdminField.Input
                id="sess-conc"
                type="number"
                min={1}
                max={10}
                value={securitySettings.sessionSettings.maxConcurrentSessions}
                onChange={(e) => setSecuritySettings((prev) => ({
                  ...prev,
                  sessionSettings: {
                    ...prev.sessionSettings,
                    maxConcurrentSessions: parseInt(e.target.value, 10) || 3,
                  },
                }))}
              />
            </AdminField>
          </div>
          <AdminField.Checkbox
            id="sess-reauth"
            label="Require re-authentication for sensitive operations"
            checked={Boolean(securitySettings.sessionSettings.requireReauthForSensitive)}
            onChange={(e) => setSecuritySettings((prev) => ({
              ...prev,
              sessionSettings: {
                ...prev.sessionSettings,
                requireReauthForSensitive: e.target.checked,
              },
            }))}
          />
        </Section>

        <Section title={tt('Security features')} icon={Shield}>
          <div className="space-y-2">
            {[
              ['rateLimiting', 'Enable rate limiting'],
              ['ipWhitelist', 'Enable IP whitelist'],
              ['suspiciousActivityDetection', 'Enable suspicious activity detection'],
              ['auditLogging', 'Enable comprehensive audit logging'],
            ].map(([key, label]) => (
              <AdminField.Checkbox
                key={key}
                id={`feat-${key}`}
                label={label}
                checked={Boolean(securitySettings.securityFeatures[key])}
                onChange={(e) => setSecuritySettings((prev) => ({
                  ...prev,
                  securityFeatures: {
                    ...prev.securityFeatures,
                    [key]: e.target.checked,
                  },
                }))}
              />
            ))}
          </div>

          {securitySettings.securityFeatures.ipWhitelist ? (
            <div className="mt-2 space-y-3">
              <AdminField label="IP address whitelist" htmlFor="ip-new" hint="Local edits are saved with security settings when you click Save.">
                <div className="flex gap-2">
                  <AdminField.Input
                    id="ip-new"
                    placeholder={tt('Enter IP address')}
                    value={newIpAddress}
                    onChange={(e) => setNewIpAddress(e.target.value)}
                  />
                  <button type="button" onClick={addWhitelistedIP} className={btnPrimary} aria-label={tt('Add IP')}>
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </AdminField>
              {whitelistedIPs.length === 0 ? (
                <AdminEmptyState
                  title={tt('No whitelisted IPs')}
                  description="Add IP addresses to restrict access when the whitelist is enabled."
                />
              ) : (
                <ul className="space-y-2">
                  {whitelistedIPs.map((ip) => (
                    <li
                      key={ip}
                      className="flex items-center justify-between rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] px-3 py-2 text-sm"
                    >
                      <span className="font-mono text-[var(--admin-text)]">{ip}</span>
                      <button
                        type="button"
                        onClick={() => setWhitelistedIPs((prev) => prev.filter((x) => x !== ip))}
                        className="text-[var(--admin-danger)] hover:opacity-80"
                        aria-label={`Remove ${ip}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </Section>

        <Section title={tt('Active sessions')} icon={User}>
          {sessionsError ? (
            <AdminErrorState
              title={tt('Sessions unavailable')}
              message={sessionsError}
              onRetry={load}
            />
          ) : null}
          {!sessionsError && activeSessions.length === 0 ? (
            <AdminEmptyState
              title={tt('No active sessions')}
              description="When the sessions API returns live admin sessions, they will appear here. Nothing is invented when the list is empty."
            />
          ) : null}
          {!sessionsError && activeSessions.length > 0 ? (
            <ul className="space-y-3">
              {activeSessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-col gap-3 rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--admin-text)]">
                      {session.userName || session.userId || 'Unknown user'}
                    </p>
                    <p className="truncate text-xs text-[var(--admin-text-muted)]">
                      {[session.ipAddress, session.userAgent].filter(Boolean).join(' · ') || 'No client details'}
                    </p>
                    <p className="text-xs text-[var(--admin-text-muted)]">
                      Last activity:{' '}
                      {session.lastActivity
                        ? new Date(session.lastActivity).toLocaleString()
                        : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <AdminStatusBadge tone={sessionTone(session)}>
                      {sessionTone(session) === 'warning' ? tt('Idle') : tt('Active')}
                    </AdminStatusBadge>
                    <button
                      type="button"
                      onClick={() => handleTerminateSession(session.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--admin-radius)] text-[var(--admin-danger)] hover:bg-[var(--admin-surface-muted)]"
                      title={tt('Terminate session')}
                      aria-label={tt('Terminate session')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      </div>
    </AdminPageContainer>
  );
}
