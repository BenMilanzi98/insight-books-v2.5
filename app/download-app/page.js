'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DownloadAppPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

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

            {data.websiteDownloadAvailable && data.apkDownloadUrl ? (
              <a
                href="/api/mobile-app/download"
                className="inline-flex w-full justify-center items-center rounded-xl bg-indigo-600 text-white font-semibold py-4 px-6 hover:bg-indigo-700 transition-colors"
              >
                Download APK
              </a>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm px-4 py-3">
                APK download is not available right now. Please try again later or use the update
                link inside the app if you already have it installed.
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
