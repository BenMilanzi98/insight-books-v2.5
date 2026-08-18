'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from 'react';
import { assertSetupSnapshot } from '@/lib/desktop/setupPayload';

function readSessionCookie() {
  if (typeof document === 'undefined') return '';
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('session='));
  return match ? decodeURIComponent(match.slice('session='.length)) : '';
}

export default function DesktopSetupPage() {
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const runSetup = useCallback(async () => {
    setStatus('running');
    setError('');
    setMessage('Preparing this PC…');

    try {
      const bridge = window.desktopBridge;
      if (!bridge?.getDeviceId || !bridge?.finishSetup) {
        throw new Error('Open this page from the Insight Books desktop app.');
      }

      const deviceId = await bridge.getDeviceId();
      if (!deviceId) throw new Error('Device ID is missing.');

      setMessage('Binding this PC to your account…');
      const bindRes = await fetch('/api/desktop/bind', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, name: 'Till' }),
      });
      const bindJson = await bindRes.json().catch(() => ({}));
      if (!bindRes.ok) {
        throw new Error(bindJson.error || 'Unable to bind this PC.');
      }

      setMessage('Downloading offline snapshot…');
      const snapRes = await fetch(
        `/api/desktop/snapshot?deviceId=${encodeURIComponent(deviceId)}`,
        { credentials: 'include', cache: 'no-store' },
      );
      const snapshot = await snapRes.json().catch(() => null);
      if (!snapRes.ok) {
        throw new Error(snapshot?.error || 'Unable to download snapshot.');
      }

      assertSetupSnapshot(snapshot);

      setMessage('Finishing setup…');
      const sessionCookie = readSessionCookie();
      await bridge.finishSetup(snapshot, sessionCookie, {
        numberPrefix: bindJson.numberPrefix,
        boundAt: bindJson.boundAt,
      });

      setStatus('done');
      setMessage('Setup complete. Loading Insight Books…');
    } catch (e) {
      setStatus('error');
      setError(e.message || 'Setup failed.');
    }
  }, []);

  useEffect(() => {
    runSetup();
  }, [runSetup]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-bold text-slate-900">{tt('Set up this PC')}</h1>
      <p className="mt-3 text-sm text-slate-600">
        {tt('We will bind this computer to your tenant and download an offline snapshot for POS work.')}
      </p>

      {status === 'running' && (
        <p className="mt-6 rounded-xl bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800">
          {message}
        </p>
      )}

      {status === 'done' && (
        <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {message}
        </p>
      )}

      {status === 'error' && (
        <div className="mt-6 space-y-3">
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={runSetup}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {tt('Try again')}
          </button>
        </div>
      )}
    </div>
  );
}
