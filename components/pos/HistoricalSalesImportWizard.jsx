'use client';
import { tt } from '@/lib/i18n/runtime';

import { useRef, useState } from 'react';
import { Download, Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';

function formatMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Simple historical sales CSV import: template → preview → confirm.
 * Does not change stock.
 */
export default function HistoricalSalesImportWizard({ onImported }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [batchName, setBatchName] = useState('');
  const [preview, setPreview] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const resetFile = () => {
    setFile(null);
    setPreview(null);
    setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = async () => {
    setError('');
    try {
      const res = await fetch('/api/historical-transactions/template', { credentials: 'include' });
      if (!res.ok) throw new Error('Could not download template');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'historical_sales_import_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || 'Template download failed');
    }
  };

  const onSelectFile = (event) => {
    const next = event.target.files?.[0];
    if (!next) return;
    setFile(next);
    setPreview(null);
    setResults(null);
    setError('');
    if (!batchName) {
      setBatchName(`HIST-${new Date().toISOString().slice(0, 10)}`);
    }
  };

  const runPreview = async () => {
    if (!file) {
      setError('Select a CSV file first');
      return;
    }
    setBusy(true);
    setError('');
    setResults(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/historical-transactions/preview', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || json.details || 'Preview failed');
      }
      setPreview(json.preview);
    } catch (e) {
      setError(e.message || 'Preview failed');
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!file || !preview?.validCount) {
      setError('Preview the file and ensure there are valid rows before importing');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append(
        'migrationBatch',
        batchName || `HIST-${new Date().toISOString().slice(0, 10)}`
      );
      const res = await fetch('/api/historical-transactions/batch-upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || json.details || 'Import failed');
      }
      setResults(json.results);
      setPreview(null);
      if (typeof onImported === 'function') onImported(json.results);
    } catch (e) {
      setError(e.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <p className="font-medium mb-1">Import past sales (go-live migration)</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>One CSV row = one completed sale on that date</li>
          <li>{tt('Dates: prefer')} <code className="bg-white/70 px-1 rounded">{tt('YYYY-MM-DD')}</code> (also DD/MM/YYYY)</li>
          <li>Accounting is posted; <strong>{tt('stock is not changed')}</strong></li>
          <li>{tt('Services belong on invoices — this import uses free-text descriptions only')}</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Download className="h-4 w-4" />
          {tt('1. Download CSV template')}
        </button>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onSelectFile}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Upload className="h-4 w-4" />
            {tt('2. Select filled CSV')}
          </button>
        </div>
      </div>

      {file && (
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center min-w-0">
              <FileText className="h-4 w-4 text-gray-500 mr-2 shrink-0" />
              <span className="text-sm text-gray-800 truncate">{file.name}</span>
              <span className="text-xs text-gray-500 ml-2 shrink-0">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            <button type="button" onClick={resetFile} className="text-red-600 hover:text-red-800">
              <X className="h-4 w-4" />
            </button>
          </div>
          <label className="block text-sm font-medium text-gray-700 mt-3 mb-1">
            Batch name (for audit / date tracking)
          </label>
          <input
            type="text"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder={`HIST-${new Date().toISOString().slice(0, 10)}`}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={runPreview}
              className="flex-1 rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              3. Preview &amp; check dates
            </button>
            <button
              type="button"
              disabled={busy || !preview?.validCount}
              onClick={runImport}
              className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              4. Confirm import ({preview?.validCount || 0} rows)
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {preview && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 space-y-2">
          <p className="font-medium">{tt('Preview')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <div className="text-blue-700">{tt('Rows')}</div>
              <div className="font-semibold">{preview.totalRows}</div>
            </div>
            <div>
              <div className="text-blue-700">{tt('Valid')}</div>
              <div className="font-semibold text-emerald-700">{preview.validCount}</div>
            </div>
            <div>
              <div className="text-blue-700">{tt('Invalid')}</div>
              <div className="font-semibold text-red-700">{preview.invalidCount}</div>
            </div>
            <div>
              <div className="text-blue-700">{tt('Total amount')}</div>
              <div className="font-semibold">{formatMoney(preview.totalAmount)}</div>
            </div>
            <div className="col-span-2">
              <div className="text-blue-700">{tt('Date range')}</div>
              <div className="font-semibold">
                {preview.dateFrom && preview.dateTo
                  ? `${preview.dateFrom} → ${preview.dateTo}`
                  : '—'}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-blue-700">{tt('Stock impact')}</div>
              <div className="font-semibold">{tt('None')}</div>
            </div>
          </div>
          {preview.validRows?.length > 0 && (
            <div className="overflow-x-auto max-h-48 border border-blue-100 rounded bg-white">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">{tt('Row')}</th>
                    <th className="px-2 py-1 text-left">{tt('Date')}</th>
                    <th className="px-2 py-1 text-left">{tt('Description')}</th>
                    <th className="px-2 py-1 text-right">{tt('Total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.validRows.slice(0, 50).map((r) => (
                    <tr key={r.rowNumber} className="border-t border-gray-100">
                      <td className="px-2 py-1">{r.rowNumber}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{r.date}</td>
                      <td className="px-2 py-1 truncate max-w-[12rem]">{r.description}</td>
                      <td className="px-2 py-1 text-right">{formatMoney(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.validRows.length > 50 && (
                <p className="px-2 py-1 text-[11px] text-gray-500">
                  Showing first 50 of {preview.validRows.length} valid rows
                </p>
              )}
            </div>
          )}
          {preview.invalidRows?.length > 0 && (
            <div className="text-xs text-red-800 space-y-1 max-h-32 overflow-y-auto">
              {preview.invalidRows.slice(0, 20).map((r) => (
                <div key={r.rowNumber}>
                  Row {r.rowNumber}: {(r.errors || []).join('; ')}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {results && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
          <div className="flex items-center gap-2 font-medium mb-2">
            <CheckCircle className="h-4 w-4" />
            {tt('Import finished')}
          </div>
          <ul className="text-xs space-y-1">
            <li>Batch: {results.migrationBatch}</li>
            <li>
              Dates: {results.dateFrom || '—'} → {results.dateTo || '—'}
            </li>
            <li>Created: {results.successful}</li>
            <li>Failed / skipped: {results.failed}</li>
            <li>{tt('Stock impact: none')}</li>
          </ul>
          {results.failedTransactions?.length > 0 && (
            <div className="mt-2 max-h-28 overflow-y-auto text-xs text-red-800">
              {results.failedTransactions.slice(0, 15).map((f, i) => (
                <div key={`${f.rowNumber}-${i}`}>
                  Row {f.rowNumber}: {f.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
