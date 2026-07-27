'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Phase 18 — System Administrator EIS Administration Centre.
 */
export default function SystemMraEisAdminCentrePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/mra-eis/admin?action=platform-overview&environment=PRODUCTION');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || json.error || 'Failed to load');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const overview = data?.overview;
  const ctx = data?.context;

  return (
    <main className="mx-auto max-w-6xl space-y-6 bg-slate-50 p-4 md:p-8">
      <header className="space-y-2">
        <p className="text-sm text-slate-600">
          <Link href="/insightbooks/mra-eis" className="underline">
            Platform MRA EIS
          </Link>
          {' / '}
          Administration Centre
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">Platform EIS Administration</h1>
        <p className="text-sm text-slate-700" role="status">
          Cross-tenant aggregation requires platform role. Drill-down into a Tenant never exposes
          credentials. Sandbox and Production remain visually distinct.
        </p>
      </header>

      {ctx ? (
        <section
          aria-label="Platform EIS context"
          className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm"
        >
          <span className="rounded border border-red-700 px-2 py-0.5 font-medium text-red-900">
            {ctx.environmentLabel}
          </span>
          <span>
            Freshness <strong>{ctx.dataFreshness}</strong>
          </span>
          <button
            type="button"
            className="ml-auto rounded border border-slate-300 px-2 py-1 text-xs"
            onClick={load}
            disabled={loading}
          >
            Refresh
          </button>
        </section>
      ) : null}

      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert">
          {error}
        </div>
      ) : null}

      <nav className="flex flex-wrap gap-2" aria-label="Platform EIS sections">
        {(data?.sections || []).map((s) => (
          <Link
            key={s.id}
            href={s.href}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {overview ? (
        <section aria-labelledby="plat-overview">
          <h2 id="plat-overview" className="text-lg font-medium">
            Platform overview
          </h2>
          <p className="text-sm text-slate-600">
            Freshness {overview.freshness}. Cross-tenant drill-down requires permission.
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {overview.cards.map((c) => (
              <li key={c.key} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-xs uppercase text-slate-500">{c.label}</p>
                {c.error ? (
                  <p className="text-sm font-medium text-red-800">Unavailable</p>
                ) : (
                  <p className="text-2xl font-semibold">{c.value}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
