'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const STEP_FROM_STATUS = {
  DRAFT: 5,
  READINESS_INCOMPLETE: 5,
  TAC_REQUIRED: 6,
  ACTIVATION_REQUEST_PENDING: 7,
  ACTIVATION_IN_PROGRESS: 7,
  ACTIVATION_RESPONSE_RECEIVED: 7,
  CREDENTIALS_PERSISTED: 7,
  CONFIRMATION_PENDING: 8,
  CONFIRMATION_IN_PROGRESS: 8,
  ACTIVE: 9,
  ACTIVATION_FAILED: 6,
  CONFIRMATION_FAILED: 8,
  UNKNOWN_ACTIVATION_OUTCOME: 7,
  UNKNOWN_CONFIRMATION_OUTCOME: 8,
  MANUAL_REVIEW: 8,
  CREDENTIAL_STORAGE_FAILED: 7,
  CONFIGURATION_BOOTSTRAP_FAILED: 7,
};

function Banner({ tone, children }) {
  const cls =
    tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-900'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-950'
        : tone === 'ok'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-slate-200 bg-slate-50 text-slate-800';
  return <div className={`rounded border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export default function MraEisOnboardingWizardPage() {
  const searchParams = useSearchParams();
  const resumeId = searchParams.get('terminalId');

  const [environment, setEnvironment] = useState('SANDBOX');
  const [terminalLabel, setTerminalLabel] = useState('Primary POS');
  const [readiness, setReadiness] = useState(null);
  const [terminal, setTerminal] = useState(null);
  const [tac, setTac] = useState('');
  const [tacReferenceId, setTacReferenceId] = useState(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const step = useMemo(() => {
    if (!terminal) return readiness ? 5 : 1;
    return STEP_FROM_STATUS[terminal.status] || 5;
  }, [terminal, readiness]);

  const loadReadiness = useCallback(async () => {
    const res = await fetch(`/api/mra-eis/terminals/readiness?environment=${encodeURIComponent(environment)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || 'Readiness check failed');
    setReadiness(json.data);
    return json.data;
  }, [environment]);

  const loadTerminal = useCallback(async (id) => {
    const res = await fetch(`/api/mra-eis/terminals/${id}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || 'Failed to load terminal');
    const t = json.data.terminal || {
      id: json.data.terminalId,
      status: json.data.status,
      environment: json.data.environment,
    };
    setTerminal({
      id: t.id || json.data.terminalId,
      status: t.status || json.data.status,
      environment: t.environment || json.data.environment,
      terminalLabel: t.terminalLabel || terminalLabel,
      version: t.version,
      mraTerminalId: t.mraTerminalId || json.data.mraTerminalId,
      productId: t.productId,
      productVersion: t.productVersion,
    });
    if (t.environment || json.data.environment) {
      setEnvironment(t.environment || json.data.environment);
    }
    return json.data;
  }, [terminalLabel]);

  useEffect(() => {
    (async () => {
      try {
        setError('');
        await loadReadiness();
        if (resumeId) await loadTerminal(resumeId);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [loadReadiness, loadTerminal, resumeId]);

  async function createTerminal() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/mra-eis/terminals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ environment, terminalLabel, scopeType: 'BUSINESS' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Create failed');
      setTerminal(json.data.terminal);
      setReadiness(json.data.readiness || readiness);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitTac() {
    if (!terminal?.id || !tac) return;
    setBusy(true);
    setError('');
    setProgress('Storing Terminal Activation Code securely…');
    try {
      const res = await fetch(`/api/mra-eis/terminals/${terminal.id}/tac`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terminalActivationCode: tac,
          expectedVersion: terminal.version,
        }),
      });
      const json = await res.json();
      setTac(''); // never retain / redisplay
      if (!res.ok) throw new Error(json?.error?.message || 'TAC submit failed');
      setTacReferenceId(json.data.tacReferenceId);
      setTerminal((t) => ({ ...t, status: json.data.status, version: (t?.version || 0) + 1 }));
      setProgress('TAC accepted ephemerally. Ready to activate.');
    } catch (err) {
      setError(err.message);
      setProgress('');
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    if (!terminal?.id || !tacReferenceId) return;
    setBusy(true);
    setError('');
    setProgress('Contacting MRA (server-side)…');
    try {
      const res = await fetch(`/api/mra-eis/terminals/${terminal.id}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ tacReferenceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Activation failed');
      setTerminal((t) => ({
        ...t,
        status: json.data.status,
        mraTerminalId: json.data.mraTerminalId || t?.mraTerminalId,
      }));
      if (json.data.tacReferenceId) setTacReferenceId(json.data.tacReferenceId);
      setProgress(
        json.data.status === 'CONFIRMATION_PENDING'
          ? 'Credentials secured. Confirmation required.'
          : `Activation result: ${json.data.status}`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!terminal?.id) return;
    setBusy(true);
    setError('');
    setProgress('Submitting activation confirmation…');
    try {
      const res = await fetch(`/api/mra-eis/terminals/${terminal.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tacReferenceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Confirmation failed');
      setTerminal((t) => ({ ...t, status: json.data.status, mraTerminalId: json.data.mraTerminalId || t?.mraTerminalId }));
      setProgress(json.data.status === 'ACTIVE' ? 'Terminal ACTIVE. Configuration sync queued.' : `Confirmation: ${json.data.status}`);
      setTacReferenceId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const envLabel =
    environment === 'PRODUCTION' ? 'PRODUCTION (gated)' : environment === 'SANDBOX' ? 'SANDBOX' : environment;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-sm font-medium text-slate-500">{tt('MRA EIS · Phase 7')}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{tt('Terminal onboarding')}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Server-authoritative wizard. TAC is masked, never placed in URLs, and never redisplayed after submit.
          JWT and terminal secrets never appear in the browser.
        </p>
      </header>

      <nav aria-label={tt('Onboarding steps')} className="mb-6 flex flex-wrap gap-2 text-xs">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span
            key={n}
            className={`rounded border px-2 py-1 ${n === step ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'}`}
          >
            Step {n}
          </span>
        ))}
      </nav>

      {error && (
        <div className="mb-4">
          <Banner tone="danger">{error}</Banner>
        </div>
      )}
      {progress && (
        <div className="mb-4">
          <Banner tone="ok">{progress}</Banner>
        </div>
      )}

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">{tt('Environment & identity')}</h2>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium">Environment (server-validated)</span>
          <select
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={environment}
            disabled={Boolean(terminal)}
            onChange={(e) => setEnvironment(e.target.value)}
          >
            <option value="SANDBOX">{tt('Sandbox / Mock')}</option>
            <option value="PRODUCTION">Production (blocked until gates pass)</option>
          </select>
        </label>
        <p className="mt-2 text-xs text-slate-500">Selected: {envLabel}. Browser cannot override API base URL.</p>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium">{tt('Terminal label')}</span>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={terminalLabel}
            disabled={Boolean(terminal)}
            onChange={(e) => setTerminalLabel(e.target.value)}
          />
        </label>
        {readiness && (
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{tt('Product ID')}</dt>
              <dd className="font-medium">{readiness.productId || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Product version')}</dt>
              <dd className="font-medium">{readiness.productVersion || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Ready to create')}</dt>
              <dd className="font-medium">{readiness.readyToCreateTerminal ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{tt('Ready to activate')}</dt>
              <dd className="font-medium">{readiness.readyToSubmitActivation ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        )}
        {(readiness?.blockers || []).length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-sm text-red-900">
            {readiness.blockers.map((b) => (
              <li key={b.code}>
                <strong>{b.code}</strong>: {b.message}
              </li>
            ))}
          </ul>
        )}
        {!terminal && (
          <button
            type="button"
            disabled={busy || !readiness?.readyToCreateTerminal}
            className="mt-4 rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            onClick={createTerminal}
          >
            {tt('Create terminal draft')}
          </button>
        )}
      </section>

      {terminal && (
        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{tt('Terminal')}</h2>
          <p className="mt-2 text-sm">
            <span className="font-medium">{terminal.terminalLabel}</span> · {terminal.status} · {terminal.environment}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500">{terminal.id}</p>
          {terminal.mraTerminalId && (
            <p className="mt-1 text-xs text-slate-600">MRA terminal ID: {terminal.mraTerminalId}</p>
          )}
        </section>
      )}

      {terminal && ['TAC_REQUIRED', 'ACTIVATION_FAILED'].includes(terminal.status) && (
        <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{tt('Terminal Activation Code')}</h2>
          <p className="mt-2 text-sm text-slate-700">
            {tt('Enter the TAC issued by MRA for environment')} <strong>{terminal.environment}</strong>. It is stored
            ephemerally on the server and never logged or shown again.
          </p>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium">TAC</span>
            <input
              type="password"
              autoComplete="off"
              name="mra-eis-tac"
              className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
              value={tac}
              onChange={(e) => setTac(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          {environment === 'PRODUCTION' && (
            <div className="mt-3">
              <Banner tone="warn">{tt('Production activation requires stronger confirmation and certification gates.')}</Banner>
            </div>
          )}
          <button
            type="button"
            disabled={busy || tac.length < 4}
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={submitTac}
          >
            {tt('Submit TAC securely')}
          </button>
        </section>
      )}

      {terminal && terminal.status === 'ACTIVATION_REQUEST_PENDING' && tacReferenceId && (
        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{tt('Activate with MRA')}</h2>
          <p className="mt-2 text-sm text-slate-600">
            Submits the activation request server-side. Ambiguous timeouts enter manual review (no blind retry).
          </p>
          <button
            type="button"
            disabled={busy}
            className="mt-4 rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            onClick={activate}
          >
            {tt('Submit activation')}
          </button>
        </section>
      )}

      {terminal && terminal.status === 'CONFIRMATION_PENDING' && (
        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{tt('Confirm activation')}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {tt('Terminal becomes ACTIVE only after confirmation succeeds. Credentials remain encrypted server-side.')}
          </p>
          <button
            type="button"
            disabled={busy}
            className="mt-4 rounded bg-emerald-800 px-4 py-2 text-sm text-white disabled:opacity-50"
            onClick={confirm}
          >
            {tt('Confirm activation')}
          </button>
        </section>
      )}

      {terminal?.status === 'ACTIVE' && (
        <section className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-lg font-semibold text-emerald-950">{tt('Onboarding complete')}</h2>
          <p className="mt-2 text-sm text-emerald-900">
            {tt('Terminal is ACTIVE. Phase 8 configuration synchronization has been queued. No Sale, Journal, or Stock Movement was created by activation.')}
          </p>
          <Link className="mt-3 inline-block text-sm font-medium underline" href={`/settings/integrations/mra-eis/terminals/${terminal.id}`}>
            {tt('View terminal health')}
          </Link>
        </section>
      )}

      {['UNKNOWN_ACTIVATION_OUTCOME', 'UNKNOWN_CONFIRMATION_OUTCOME', 'MANUAL_REVIEW', 'CREDENTIAL_STORAGE_FAILED'].includes(
        terminal?.status
      ) && (
        <div className="mb-4">
          <Banner tone="warn">
            {tt('This terminal requires manual review or recovery. Ordinary retry is blocked for unknown outcomes.')}
          </Banner>
        </div>
      )}

      <p className="mt-6 text-sm">
        <Link href="/settings/integrations/mra-eis/terminals" className="text-slate-600 underline">
          ← Terminal list
        </Link>
      </p>
    </div>
  );
}
