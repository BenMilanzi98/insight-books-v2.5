'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const APK_FILENAME = 'InsightBooks-android.apk';
const WINDOWS_FILENAME = 'InsightBooks-desktop-setup.exe';
const WINDOWS_DOWNLOAD_URL = '/downloads/InsightBooks-desktop-setup.exe';
const WINDOWS_MIN_VERSION = 'Windows 10 x64';
const APP_TITLE = 'Insight Books';
const DEVELOPER_NAME = 'Insight Innovations Ltd';
const MIN_ANDROID_VERSION = '8.0';
const SHORT_DESCRIPTION =
  'Secure Android access for Insight Books business management.';
const FULL_DESCRIPTION =
  'Install the official Insight Books Android app to manage sales, invoices, expenses, customers, inventory, payments, and business activity from your phone. The mobile app connects to the same Insight Books account and keeps your team close to the work wherever they are.';
const FEATURES = [
  'Point of sale and quick sales recording',
  'Invoices, customers, and payment tracking',
  'Expense and supplier management',
  'Stock visibility and product pricing',
  'Mobile access to business activity',
  'Official release delivered through Insight Books',
];
const INSTALL_STEPS = [
  'Tap Download latest APK and wait for the download progress to complete.',
  'Open the downloaded APK from your browser or Downloads folder.',
  'If Android asks for permission, allow installs from this browser/source.',
  'Complete installation, then open Insight Books and sign in with your existing account.',
];

function resolveFetchUrl(apkDownloadUrl) {
  if (!apkDownloadUrl || typeof window === 'undefined') return '';
  const u = String(apkDownloadUrl).trim();
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return `${window.location.origin}${u}`;
  return `${window.location.origin}/${u.replace(/^\//, '')}`;
}

function isZipApkMagic(bytes) {
  if (!bytes || bytes.byteLength < 4) return false;
  const a = new Uint8Array(bytes);
  return a[0] === 0x50 && a[1] === 0x4b && a[2] === 0x03 && a[3] === 0x04;
}

function formatDate(value) {
  if (!value) return 'Pending';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Pending';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function releaseNotesList(notes) {
  if (!notes || typeof notes !== 'string') return [];
  return notes
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
}

/**
 * Fetch APK bytes with progress. Uses Content-Length when present for percentage.
 * @returns {{ blob: Blob, contentLengthKnown: boolean }}
 */
async function fetchApkWithProgress(url, onProgress) {
  const res = await fetch(url, {
    cache: 'no-store',
    credentials: 'omit',
    headers: { Accept: '*/*' },
  });
  if (!res.ok) {
    let msg = `Download failed (${res.status})`;
    try {
      const t = await res.text();
      if (t) {
        try {
          const j = JSON.parse(t);
          if (j.error) msg = j.error;
        } catch {
          if (t.length < 200) msg = t;
        }
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const lenHeader = res.headers.get('content-length');
  const total = lenHeader ? parseInt(lenHeader, 10) : NaN;
  const hasTotal = Number.isFinite(total) && total > 0;

  const reader = res.body?.getReader();
  if (!reader) {
    const buf = await res.arrayBuffer();
    onProgress(1, buf.byteLength, buf.byteLength);
    return {
      blob: new Blob([buf], { type: 'application/vnd.android.package-archive' }),
      contentLengthKnown: hasTotal,
    };
  }

  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value?.length) {
      chunks.push(value);
      received += value.length;
      if (hasTotal) {
        onProgress(Math.min(1, received / total), received, total);
      } else {
        onProgress(null, received, null);
      }
    }
  }

  if (hasTotal && received !== total) {
    throw new Error('Download incomplete. Check your connection and try again.');
  }

  if (hasTotal) onProgress(1, received, total);
  else onProgress(1, received, received);

  return {
    blob: new Blob(chunks, { type: 'application/vnd.android.package-archive' }),
    contentLengthKnown: hasTotal,
  };
}

export default function DownloadAppPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  const [downloadPhase, setDownloadPhase] = useState('idle'); // idle | loading | saving | done | error
  const [progress, setProgress] = useState(0);
  const [progressIndeterminate, setProgressIndeterminate] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [downloadErr, setDownloadErr] = useState(null);
  const blobRef = useRef(null);
  const blobUrlRef = useRef(null);

  const revokeBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    blobRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/mobile-app/version', { cache: 'no-store' });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Failed to load');
        if (!cancelled) setData(j);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => revokeBlobUrl(), [revokeBlobUrl]);

  /** Public app page: same-origin proxy streams external APKs (avoids CORS on files.fm, etc.). */
  const proxyFetchUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/mobile-app/proxy-apk` : '';
  /** Original link for "open direct" fallback (admin may point to a third-party host). */
  const directApkUrl = data?.apkDownloadUrl ? resolveFetchUrl(data.apkDownloadUrl) : '';

  const runDownload = async () => {
    if (!proxyFetchUrl) return;
    setDownloadErr(null);
    revokeBlobUrl();
    setProgress(0);
    setProgressIndeterminate(false);
    setProgressLabel('Starting…');
    setDownloadPhase('loading');

    try {
      const { blob, contentLengthKnown } = await fetchApkWithProgress(proxyFetchUrl, (ratio, received, total) => {
        const mb = received / (1024 * 1024);
        if (ratio == null) {
          setProgress(0);
          setProgressIndeterminate(true);
          setProgressLabel(`${mb.toFixed(1)} MB downloaded`);
          return;
        }
        setProgressIndeterminate(false);
        const pct = Math.round(ratio * 100);
        setProgress(ratio);
        if (total > 0) {
          const tmb = total / (1024 * 1024);
          setProgressLabel(`${pct}% · ${mb.toFixed(1)} / ${tmb.toFixed(1)} MB`);
        } else {
          setProgressLabel(
            ratio >= 1 ? `100% · ${mb.toFixed(1)} MB complete` : `${pct}% · ${mb.toFixed(1)} MB`,
          );
        }
      });
      const head = await blob.slice(0, 4).arrayBuffer();
      if (!isZipApkMagic(head)) {
        throw new Error('The file is not a valid app package. Ask your administrator to check the download link.');
      }

      blobRef.current = blob;
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      setDownloadPhase('saving');
      setProgressLabel('Saving to Downloads…');
      setProgress(1);

      const a = document.createElement('a');
      a.href = url;
      a.download = APK_FILENAME;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();

      setDownloadPhase('done');
      setProgressLabel('Saved to your Downloads folder.');
    } catch (e) {
      const msg =
        e.name === 'TypeError' && String(e.message).includes('fetch')
          ? 'Could not reach the download server. If the link is on another site, open it in the browser instead.'
          : e.message || 'Download failed';
      setDownloadErr(msg);
      setDownloadPhase('error');
      setProgress(0);
      setProgressLabel('');
      revokeBlobUrl();
    }
  };

  const openForInstall = () => {
    const url = blobUrlRef.current;
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const resetDownload = () => {
    revokeBlobUrl();
    setDownloadPhase('idle');
    setProgress(0);
    setProgressIndeterminate(false);
    setProgressLabel('');
    setDownloadErr(null);
  };

  // `websiteDownloadAvailable` is only true when a file exists at public/releases/ and the
  // site is not locked. A custom `apkDownloadUrl` in admin still populates `apkDownloadUrl`
  // in the API with `websiteDownloadAvailable: false` — the page must not require that flag.
  const canDownload = Boolean(
    (data?.apkDownloadUrl && String(data.apkDownloadUrl).trim() !== '') && proxyFetchUrl,
  );
  const busy = downloadPhase === 'loading' || downloadPhase === 'saving';
  const notes = releaseNotesList(data?.releaseNotes);
  const latestVersionName = data?.latestVersionName || 'Pending';
  const latestVersionCode = data?.latestVersionCode ?? null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900">
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_15%_10%,rgba(96,165,250,.28),transparent_28%),radial-gradient(circle_at_78%_15%,rgba(129,140,248,.34),transparent_30%),linear-gradient(135deg,#040b16_0%,#0f172a_38%,#1e1b4b_72%,#312e81_100%)] text-white">
        <div className="absolute -left-16 top-8 h-56 w-56 rounded-full bg-indigo-400/25 blur-md" />
        <div className="absolute bottom-10 right-[12%] h-44 w-44 rounded-full bg-blue-400/25 blur-md" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[length:42px_42px] opacity-70 [mask-image:linear-gradient(to_bottom,#000,transparent_75%)]" />

        <div className="relative mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-20">
          {err && (
            <div className="mb-8 rounded-2xl border border-red-200/40 bg-red-50/95 px-4 py-3 text-sm text-red-700 shadow-lg">
              {err}
            </div>
          )}

          <div className="grid gap-10 lg:grid-cols-[1.25fr_.85fr] lg:items-center">
            <div>
              <div className="mb-5 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-100">
                {tt('Official Android Download Center')}
              </div>

              <div className="mb-6 flex items-center gap-5">
                <div className="flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-[2rem] border border-white/70 bg-gradient-to-br from-white to-blue-50 p-3 shadow-2xl shadow-black/30">
                  <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 text-4xl font-black text-white">
                    {tt('IB')}
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                    {APP_TITLE}
                  </h1>
                  <p className="mt-3 text-lg font-semibold text-slate-300">
                    {tt('Official Android app for Insight Books users.')}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-slate-100">
                      Version {latestVersionName}
                      {latestVersionCode != null ? ` (${latestVersionCode})` : ''}
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-slate-100">
                      Android {MIN_ANDROID_VERSION}+
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-slate-100">
                      {tt('Verified official release')}
                    </span>
                  </div>
                </div>
              </div>

              <p className="max-w-3xl text-base leading-8 text-blue-50 sm:text-lg">
                {SHORT_DESCRIPTION}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={runDownload}
                  disabled={!canDownload || busy}
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-sky-500 px-8 py-4 text-base font-extrabold text-white shadow-xl shadow-blue-500/30 transition hover:-translate-y-0.5 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {busy ? 'Downloading...' : 'Download latest APK'}
                </button>
                <span className="text-sm font-bold text-emerald-200">
                  {tt('Download only from this official Insight Books page.')}
                </span>
              </div>

              <p className="mt-4 text-sm text-slate-300">
                Developer: {DEVELOPER_NAME} · Minimum Android {MIN_ANDROID_VERSION}+
              </p>
            </div>

            <div className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl shadow-black/25 backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-2 text-sm font-extrabold text-blue-100">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(34,197,94,.14),0_0_24px_rgba(34,197,94,.8)]" />
                {tt('Secure distribution')}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-xs text-blue-200">{tt('Current version')}</p>
                  <p className="mt-1 text-lg font-extrabold">{latestVersionName}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-xs text-blue-200">{tt('Compatibility')}</p>
                  <p className="mt-1 text-lg font-extrabold">Android {MIN_ANDROID_VERSION}+</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-xs text-blue-200">{tt('Updated')}</p>
                  <p className="mt-1 text-lg font-extrabold">{formatDate(data?.publishedAt)}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-xs text-blue-200">{tt('Availability')}</p>
                  <p className="mt-1 text-lg font-extrabold">
                    {canDownload ? 'Ready' : 'Unavailable'}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-950/35 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">
                  {tt('Security notice')}
                </p>
                <p className="mt-2 text-sm leading-6 text-blue-50">
                  {tt('Verify the developer, version, and this official domain before installing. Android may ask you to allow installs from your browser.')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative -mt-6 rounded-t-[2rem] bg-gradient-to-b from-slate-50 to-indigo-50 py-10 shadow-[0_-20px_60px_rgba(15,23,42,.18)]">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 lg:grid-cols-[1fr_22rem] lg:px-8">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-indigo-600">
                {tt('Download')}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">{tt('Install the latest Android app')}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The download button below keeps the current `/download-app` behavior: it streams the APK,
                shows progress, validates the package, then saves it to your Downloads folder.
              </p>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {data ? (
                  canDownload ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 text-left">
                      {downloadPhase === 'idle' && (
                        <button
                          type="button"
                          onClick={runDownload}
                          className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-sky-600 px-6 py-4 font-extrabold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:shadow-xl"
                        >
                          {tt('Download APK')}
                        </button>
                      )}

                      {(downloadPhase === 'loading' || downloadPhase === 'saving') && (
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm font-semibold text-slate-700">
                            <span>{downloadPhase === 'saving' ? 'Saving' : 'Downloading'}</span>
                            <span>
                              {downloadPhase === 'loading' && progressIndeterminate
                                ? '...'
                                : downloadPhase === 'loading' && progress > 0
                                  ? `${Math.round(progress * 100)}%`
                                  : downloadPhase === 'loading'
                                    ? '-'
                                    : '100%'}
                            </span>
                          </div>
                          <div
                            className="h-3 w-full overflow-hidden rounded-full bg-slate-200"
                            role="progressbar"
                            aria-valuenow={
                              progressIndeterminate ? 0 : Math.round(progress * 100)
                            }
                            aria-valuetext={progressIndeterminate ? 'Downloading' : undefined}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            {progressIndeterminate ? (
                              <div className="h-full w-full animate-pulse rounded-full bg-indigo-500/45" />
                            ) : (
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-sky-500 transition-[width] duration-150 ease-out"
                                style={{
                                  width:
                                    downloadPhase === 'saving'
                                      ? '100%'
                                      : `${Math.max(2, Math.round(progress * 100))}%`,
                                }}
                              />
                            )}
                          </div>
                          <p className="text-sm text-slate-500">{progressLabel}</p>
                        </div>
                      )}

                      {downloadPhase === 'done' && (
                        <div className="space-y-3">
                          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                            {progressLabel}
                          </p>
                          <button
                            type="button"
                            onClick={openForInstall}
                            className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 py-4 font-extrabold text-white transition hover:bg-emerald-700"
                          >
                            {tt('Install app')}
                          </button>
                          <p className="text-xs leading-5 text-slate-500">
                            {tt('Opens the APK so Android can run the installer. If nothing happens, open your Downloads folder and tap the APK file.')}
                          </p>
                          <button
                            type="button"
                            onClick={resetDownload}
                            className="w-full py-2 text-sm font-semibold text-indigo-600 hover:underline"
                          >
                            {tt('Download again')}
                          </button>
                        </div>
                      )}

                      {downloadPhase === 'error' && (
                        <div className="space-y-3">
                          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{downloadErr}</p>
                          <a
                            href={directApkUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 transition hover:bg-slate-50"
                          >
                            {tt('Open file link')}
                          </a>
                          <button
                            type="button"
                            onClick={resetDownload}
                            className="w-full rounded-2xl bg-indigo-600 px-6 py-3 font-extrabold text-white transition hover:bg-indigo-700"
                          >
                            {tt('Try again')}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <p>
                        {tt('No download link is available from the server, or the website download is locked.')}
                      </p>
                      <p className="mt-2 text-amber-800">
                        {tt('Please check back shortly or contact your administrator.')}
                      </p>
                    </div>
                  )
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    {tt('Loading release details...')}
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 text-left">
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-indigo-600">
                    Windows x64
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-slate-950">Insight Books Desktop</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Offline-capable POS for Windows. Requires an active subscription and one-time online setup.
                  </p>
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Compatibility</dt>
                      <dd className="font-semibold text-slate-900">{WINDOWS_MIN_VERSION}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Updated</dt>
                      <dd className="font-semibold text-slate-900">{formatDate(null)}</dd>
                    </div>
                  </dl>
                  <a
                    href={WINDOWS_DOWNLOAD_URL}
                    download={WINDOWS_FILENAME}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-slate-800 to-slate-950 px-6 py-4 font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    Download Windows installer
                  </a>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    If the installer is not yet published, check back shortly or contact your administrator.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-indigo-600">
                {tt('Overview')}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">{tt('About this app')}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{FULL_DESCRIPTION}</p>

              {notes.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-bold text-slate-950">What&apos;s new in v{latestVersionName}</h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    {notes.map((note, index) => (
                      <li key={`${note}-${index}`} className="flex gap-3">
                        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-indigo-600">
                {tt('Highlights')}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">{tt('Features')}</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {FEATURES.map((feature) => (
                  <div
                    key={feature}
                    className="flex gap-3 rounded-2xl border border-slate-100 bg-gradient-to-b from-white to-slate-50 p-4 text-sm font-semibold text-slate-700"
                  >
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">
                      ✓
                    </span>
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-indigo-600">
                {tt('Setup')}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">{tt('Install instructions')}</h2>
              <ol className="mt-5 space-y-3 rounded-2xl bg-slate-950 p-5 text-sm leading-6 text-slate-100">
                {INSTALL_STEPS.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-blue-100">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-indigo-600">
                {tt('Releases')}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">{tt('Version history')}</h2>
              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">{tt('Version')}</th>
                      <th className="px-4 py-3 font-semibold">{tt('Code')}</th>
                      <th className="px-4 py-3 font-semibold">{tt('Released')}</th>
                      <th className="px-4 py-3 font-semibold">{tt('Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-semibold text-slate-900">{latestVersionName}</td>
                      <td className="px-4 py-3 text-slate-600">{latestVersionCode ?? '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(data?.publishedAt)}</td>
                      <td className="px-4 py-3 text-emerald-700">{tt('Latest')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">{tt('App info')}</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">{tt('Version')}</dt>
                  <dd className="font-semibold text-slate-900">
                    {latestVersionName}
                    {latestVersionCode != null ? ` (${latestVersionCode})` : ''}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">{tt('Updated')}</dt>
                  <dd className="font-semibold text-slate-900">{formatDate(data?.publishedAt)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">{tt('Compatibility')}</dt>
                  <dd className="font-semibold text-slate-900">Android {MIN_ANDROID_VERSION}+</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">{tt('Developer')}</dt>
                  <dd className="font-semibold text-slate-900">{DEVELOPER_NAME}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={runDownload}
                disabled={!canDownload || busy}
                className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-sky-600 px-5 py-3 font-extrabold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {tt('Download latest APK')}
              </button>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">{tt('Rating breakdown')}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {tt('Reviews and rating totals are managed in the Android App Center. This page focuses on the official release and protected APK download.')}
              </p>
              <div className="mt-4 space-y-2">
                {[5, 4, 3, 2, 1].map((rating) => (
                  <div key={rating} className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="w-3">{rating}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: rating === 5 ? '70%' : '0%' }} />
                    </div>
                    <span>—</span>
                  </div>
                ))}
              </div>
            </div>

            <Link href="/" className="inline-flex text-sm font-semibold text-indigo-600 hover:underline">
              {tt('Back to home')}
            </Link>
          </aside>
        </div>
      </section>
    </div>
  );
}
