'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const APK_FILENAME = 'InsightBooks-android.apk';

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Insight Books — Android</h1>
        <p className="mt-2 text-slate-600 text-sm leading-relaxed">
          Install the mobile app for POS, invoicing, expenses, and more. Same account as the web
          dashboard.
        </p>

        {err && (
          <p className="mt-8 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{err}</p>
        )}

        {data && (
          <div className="mt-10 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-5 py-4 text-left text-sm">
              <p className="text-slate-500">Latest version</p>
              <p className="text-lg font-semibold text-slate-900">
                {data.latestVersionName}{' '}
                <span className="text-slate-400 font-normal">({data.latestVersionCode})</span>
              </p>
            </div>

            {canDownload ? (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-5 py-5 text-left space-y-4">
                {downloadPhase === 'idle' && (
                  <button
                    type="button"
                    onClick={runDownload}
                    className="inline-flex w-full justify-center items-center rounded-xl bg-indigo-600 text-white font-semibold py-4 px-6 hover:bg-indigo-700 transition-colors"
                  >
                    Download APK
                  </button>
                )}

                {(downloadPhase === 'loading' || downloadPhase === 'saving') && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>{downloadPhase === 'saving' ? 'Saving' : 'Downloading'}</span>
                      <span>
                        {downloadPhase === 'loading' && progressIndeterminate
                          ? '…'
                          : downloadPhase === 'loading' && progress > 0
                            ? `${Math.round(progress * 100)}%`
                            : downloadPhase === 'loading'
                              ? '—'
                              : ''}
                      </span>
                    </div>
                    <div
                      className="h-3 w-full rounded-full bg-slate-200 overflow-hidden"
                      role="progressbar"
                      aria-valuenow={
                        progressIndeterminate ? 0 : Math.round(progress * 100)
                      }
                      aria-valuetext={progressIndeterminate ? 'Downloading' : undefined}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      {progressIndeterminate ? (
                        <div className="h-full w-full rounded-full bg-indigo-500/45 animate-pulse" />
                      ) : (
                        <div
                          className="h-full rounded-full bg-indigo-600 transition-[width] duration-150 ease-out"
                          style={{
                            width:
                              downloadPhase === 'saving'
                                ? '100%'
                                : `${Math.max(2, Math.round(progress * 100))}%`,
                          }}
                        />
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{progressLabel}</p>
                  </div>
                )}

                {downloadPhase === 'done' && (
                  <div className="space-y-3">
                    <p className="text-sm text-emerald-700 font-medium">{progressLabel}</p>
                    <button
                      type="button"
                      onClick={openForInstall}
                      className="inline-flex w-full justify-center items-center rounded-xl bg-emerald-600 text-white font-semibold py-4 px-6 hover:bg-emerald-700 transition-colors"
                    >
                      Install app
                    </button>
                    <p className="text-xs text-slate-500">
                      Opens the APK so Android can run the installer. You may need to allow installs
                      from this source. If nothing happens, open your Downloads folder and tap the
                      APK file.
                    </p>
                    <button
                      type="button"
                      onClick={resetDownload}
                      className="w-full text-sm text-indigo-600 hover:underline py-2"
                    >
                      Download again
                    </button>
                  </div>
                )}

                {downloadPhase === 'error' && (
                  <div className="space-y-3">
                    <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{downloadErr}</p>
                    <a
                      href={directApkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-full justify-center items-center rounded-xl border border-slate-300 bg-white text-slate-800 font-medium py-3 px-6 hover:bg-slate-50 transition-colors"
                    >
                      Open file link
                    </a>
                    <button
                      type="button"
                      onClick={resetDownload}
                      className="w-full rounded-xl bg-indigo-600 text-white font-semibold py-3 px-6 hover:bg-indigo-700 transition-colors"
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm px-4 py-3 text-left">
                <p>
                  No download link is available from the server (no hosted release file and no
                  public URL in admin, or the site download is locked).
                </p>
                <p className="mt-2 text-amber-800">
                  In <span className="font-medium">Insight Books → Mobile app</span>, upload an APK or
                  set “APK download URL”, and ensure “Lock website APK download” is off if you use the
                  hosted file.
                </p>
              </div>
            )}

            <p className="text-xs text-slate-500 pt-4">
              On Android, you may need to allow installs from your browser. Only download from this
              official site.
            </p>

            <Link href="/" className="inline-block text-sm text-indigo-600 hover:underline mt-6">
              ← Back to home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
