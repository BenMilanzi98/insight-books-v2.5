'use client';
import { tt } from '@/lib/i18n/runtime';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Simple four-column stock export for the current Business.
 */
export default function StockBasicExportPage() {
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function download() {
    setError('');
    setBusy(true);
    try {
      const qs = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const res = await fetch(`/api/stock/basic-export${qs}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Export failed');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] || 'Stock_Export.xlsx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{tt('Stock Export')}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Exports Item Name, Quantity, Order Price (weighted-average cost), and Selling Price for the current Business.
          </p>
        </div>
        <Link href="/stock" className="text-sm font-medium text-indigo-700 hover:underline">
          {tt('Back to Stock')}
        </Link>
      </div>

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">
          Search (optional)
          <input
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tt('Filter by item name or SKU')}
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          disabled={busy}
          onClick={download}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Preparing…' : 'Download Excel'}
        </button>
      </div>
    </div>
  );
}
