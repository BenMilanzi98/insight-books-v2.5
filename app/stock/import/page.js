'use client';
import { tt } from '@/lib/i18n/runtime';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Simple Business-scoped stock import (4 columns).
 * Branch/warehouse is not selected — Business uses the hidden primary location.
 */
export default function StockBasicImportPage() {
  const [file, setFile] = useState(null);
  const [purpose, setPurpose] = useState('STOCK_RECEIPT_IMPORT');
  const [updateSellingPrice, setUpdateSellingPrice] = useState(true);
  const [forceAsNewReceipt, setForceAsNewReceipt] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function downloadTemplate(withExample) {
    const res = await fetch(`/api/stock/basic-import/template?example=${withExample ? '1' : '0'}`);
    if (!res.ok) throw new Error('Template download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Stock_Import_Template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  function buildForm() {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('purpose', purpose);
    fd.append('updateSellingPrice', updateSellingPrice ? 'true' : 'false');
    fd.append('forceAsNewReceipt', forceAsNewReceipt ? 'true' : 'false');
    return fd;
  }

  async function runPreview() {
    setError('');
    setResult(null);
    if (!file) {
      setError('Choose an Excel file first.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/stock/basic-import/preview', { method: 'POST', body: buildForm() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview failed');
      setPreview(data.preview);
    } catch (e) {
      setError(e.message || 'Preview failed');
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function runConfirm() {
    setError('');
    if (!file) {
      setError('Choose an Excel file first.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/stock/basic-import/confirm', { method: 'POST', body: buildForm() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Confirm failed');
      setResult(data.result);
    } catch (e) {
      setError(e.message || 'Confirm failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{tt('Stock Import')}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Columns: Item Name, Quantity, Order Price, Selling Price. Scoped to the current Business (no branch setup).
          </p>
        </div>
        <Link href="/stock" className="text-sm font-medium text-indigo-700 hover:underline">
          {tt('Back to Stock')}
        </Link>
      </div>

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadTemplate(false).catch((e) => setError(e.message))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {tt('Download blank template')}
          </button>
          <button
            type="button"
            onClick={() => downloadTemplate(true).catch((e) => setError(e.message))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {tt('Download template with example row')}
          </button>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          {tt('Excel file')}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="mt-1 block w-full text-sm"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setPreview(null);
              setResult(null);
            }}
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          {tt('Import purpose')}
          <select
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          >
            <option value="STOCK_RECEIPT_IMPORT">{tt('Stock receipt import')}</option>
            <option value="OPENING_STOCK_IMPORT">{tt('Opening stock import')}</option>
            <option value="DATA_MIGRATION_IMPORT">{tt('Data migration import')}</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={updateSellingPrice}
            onChange={(e) => setUpdateSellingPrice(e.target.checked)}
          />
          {tt('Update Selling Price on matched Items')}
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={forceAsNewReceipt}
            onChange={(e) => setForceAsNewReceipt(e.target.checked)}
          />
          Import as a new stock receipt (if this file was imported before)
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !file}
            onClick={runPreview}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Preview'}
          </button>
          <button
            type="button"
            disabled={busy || !file || !preview}
            onClick={runConfirm}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {tt('Confirm import')}
          </button>
        </div>
      </div>

      {preview ? (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-medium text-slate-900">{tt('Preview')}</h2>
          {preview.duplicateFileWarning ? (
            <p className="mt-2 text-sm text-amber-700">
              {tt('This file was imported before. Enable “Import as a new stock receipt” to post again.')}
            </p>
          ) : null}
          <ul className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
            <li>Valid / ready: {preview.summary.validRows}</li>
            <li>Warnings: {preview.summary.warningRows}</li>
            <li>Invalid: {preview.summary.invalidRows}</li>
            <li>New Items: {preview.summary.newItems}</li>
            <li>Matched Items: {preview.summary.matchedItems}</li>
            <li>Incoming qty: {preview.summary.totalIncomingQuantity}</li>
            <li>Incoming value: {preview.summary.totalIncomingValue}</li>
          </ul>
          <table className="mt-4 min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-600">
                <th className="py-2 pr-3">{tt('Row')}</th>
                <th className="py-2 pr-3">{tt('Item')}</th>
                <th className="py-2 pr-3">{tt('Match')}</th>
                <th className="py-2 pr-3">{tt('Qty')}</th>
                <th className="py-2 pr-3">{tt('Order')}</th>
                <th className="py-2 pr-3">{tt('Sell')}</th>
                <th className="py-2 pr-3">{tt('After qty')}</th>
                <th className="py-2 pr-3">{tt('WAC after')}</th>
                <th className="py-2 pr-3">{tt('Status')}</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((r) => (
                <tr key={`${r.rowNumber}-${r.normalizedName || r.itemName}`} className="border-b border-slate-100">
                  <td className="py-2 pr-3">{r.rowNumber}</td>
                  <td className="py-2 pr-3">{r.itemName}</td>
                  <td className="py-2 pr-3">{r.matchStatus}</td>
                  <td className="py-2 pr-3">{r.quantity ?? '—'}</td>
                  <td className="py-2 pr-3">{r.orderPrice ?? '—'}</td>
                  <td className="py-2 pr-3">{r.sellingPrice ?? '—'}</td>
                  <td className="py-2 pr-3">{r.quantityAfter ?? '—'}</td>
                  <td className="py-2 pr-3">{r.wacAfter ?? '—'}</td>
                  <td className="py-2 pr-3">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {result ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">Import {result.idempotent ? 'already completed' : 'posted'}.</p>
          <p className="mt-1">Batch: {result.batchId}</p>
          <p className="mt-1">Items posted: {result.summary?.postedItems ?? result.results?.length ?? 0}</p>
          {result.accountingNote ? <p className="mt-2 text-emerald-800">{result.accountingNote}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
