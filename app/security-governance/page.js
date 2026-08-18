'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from 'react';
import { Shield, RefreshCw, AlertCircle, KeyRound, FileSearch } from 'lucide-react';

async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || res.statusText);
  return data;
}

export default function SecurityGovernancePage() {
  const [dashboard, setDashboard] = useState(null);
  const [actor, setActor] = useState(null);
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [d, a, aud, al, sess] = await Promise.all([
        api('/api/security-governance/dashboard'),
        api('/api/security-governance/actor'),
        api('/api/security-governance/audit?take=20'),
        api('/api/security-governance/alerts').catch(() => ({ alerts: [] })),
        api('/api/security-governance/sessions').catch(() => ({ sessions: [] })),
      ]);
      setDashboard(d.dashboard);
      setActor(a.actor);
      setEvents(aud.events || []);
      setAlerts(al.alerts || []);
      setSessions(sess.sessions || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revokeOthers = async () => {
    setBusy(true);
    try {
      await api('/api/security-governance/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revokeOthers' }),
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const runIntegrity = async () => {
    setBusy(true);
    try {
      const data = await api('/api/security-governance/audit?integrity=1');
      setError(
        data.integrity?.valid
          ? 'Audit integrity check passed.'
          : `Audit integrity issues: ${data.integrity?.failures?.length || 0}`
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-slate-800" />
            Security &amp; Governance
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Platform authorization, approvals, segregation of duties, immutable audit trail, and
            session controls. Server-side enforcement — menu visibility is not a security control.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-300 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
          {tt('Refresh')}
        </button>
      </header>

      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      ) : null}

      <section className="grid md:grid-cols-4 gap-3">
        {[
          ['Open alerts', dashboard?.openAlerts],
          ['Critical alerts', dashboard?.criticalAlerts],
          ['Active sessions', dashboard?.activeSessions],
          ['Pending approvals', dashboard?.pendingApprovals],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{value ?? '—'}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm space-y-2">
        <h2 className="font-medium flex items-center gap-2">
          <KeyRound className="w-4 h-4" />
          {tt('Actor context')}
        </h2>
        {actor ? (
          <dl className="grid sm:grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-slate-500">{tt('Effective user')}</dt>
              <dd className="font-mono">{actor.effectiveUserId}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Business')}</dt>
              <dd className="font-mono">{actor.businessId}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Roles')}</dt>
              <dd>{(actor.roles || []).join(', ') || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Permissions (count)</dt>
              <dd>{actor.permissionsCount}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Session')}</dt>
              <dd className="font-mono break-all">{actor.sessionId || 'legacy / untracked'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Impersonating')}</dt>
              <dd>{actor.isImpersonating ? tt('Yes') : tt('No')}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-slate-500">{tt('Not loaded')}</p>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={revokeOthers}
            className="px-3 py-1.5 text-xs rounded border border-slate-300"
          >
            {tt('Revoke other sessions')}
          </button>
          <button
            type="button"
            onClick={runIntegrity}
            className="px-3 py-1.5 text-xs rounded border border-slate-300 inline-flex items-center gap-1"
          >
            <FileSearch className="w-3.5 h-3.5" />
            {tt('Verify audit integrity')}
          </button>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-medium mb-2">{tt('Recent audit events')}</h2>
          {(events || []).length === 0 ? (
            <p className="text-sm text-slate-500">{tt('No SecV2 audit events yet.')}</p>
          ) : (
            <ul className="text-xs space-y-2 max-h-80 overflow-auto">
              {events.map((e) => (
                <li key={e.id} className="border-b border-slate-100 pb-2">
                  <div className="font-medium">
                    {e.eventType} · {e.outcome}
                  </div>
                  <div className="text-slate-500">
                    {e.action || '—'} · {e.actorId || 'system'} ·{' '}
                    {e.recordedAt ? new Date(e.recordedAt).toLocaleString() : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-medium mb-2">{tt('Security alerts')}</h2>
          {(alerts || []).length === 0 ? (
            <p className="text-sm text-slate-500">{tt('No open alerts.')}</p>
          ) : (
            <ul className="text-xs space-y-2 max-h-80 overflow-auto">
              {alerts.map((a) => (
                <li key={a.id} className="border-b border-slate-100 pb-2">
                  <div className="font-medium">
                    [{a.severity}] {a.eventType}
                  </div>
                  <div className="text-slate-500">{a.description}</div>
                </li>
              ))}
            </ul>
          )}
          <h2 className="font-medium mb-2 mt-4">{tt('Your active sessions')}</h2>
          {(sessions || []).length === 0 ? (
            <p className="text-sm text-slate-500">{tt('No tracked sessions.')}</p>
          ) : (
            <ul className="text-xs space-y-1">
              {sessions.map((s) => (
                <li key={s.id} className="font-mono">
                  {s.id.slice(0, 8)}… · {s.status} · {s.ipAddress || 'ip?'}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="text-xs text-slate-500">
        {dashboard?.note ||
          'Controls are advisory toward compliance readiness — not a certification claim.'}
      </p>
    </div>
  );
}
