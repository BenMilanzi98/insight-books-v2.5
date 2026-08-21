'use client';
import { tt } from '@/lib/i18n/runtime';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import FormField, { Input } from '@/components/ui/FormField';
import {
  GUIDED_IMPORT_ACCEPT,
  assertAllowedGuidedStatementFile,
  buildConfirmImportFormData,
  buildPreviewImportFormData,
  confirmStatementImport,
  previewStatementImport,
} from './reconApi.js';

function formatDate(value) {
  if (!value) return '';
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function formatAmount(row) {
  if (row?.signedAmount != null && row.signedAmount !== '') return String(row.signedAmount);
  if (row?.signedAmountMinor != null) return String(Number(row.signedAmountMinor) / 100);
  return '';
}

export default function ImportStep({
  paymentAccountId,
  reconciliationId,
  workspace,
  onConfirmed,
}) {
  const recon = workspace?.reconciliation;
  const existingCount = Array.isArray(workspace?.statements) ? workspace.statements.length : 0;
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (event) => {
    const next = event.target.files?.[0] || null;
    setPreview(null);
    setError('');
    if (!next) {
      setFile(null);
      return;
    }
    try {
      assertAllowedGuidedStatementFile(next.name);
      setFile(next);
    } catch (err) {
      setFile(null);
      event.target.value = '';
      setError(err.message);
    }
  };

  const handlePreview = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (!file) throw new Error('Choose a CSV or Excel file first.');
      if (!paymentAccountId) throw new Error('Missing payment account.');
      assertAllowedGuidedStatementFile(file.name);
      const data = await previewStatementImport(
        buildPreviewImportFormData({
          file,
          paymentAccountId,
          statementOpening: recon?.statementOpeningBalance,
          statementClosing: recon?.statementClosingBalance,
        })
      );
      setPreview(data);
    } catch (err) {
      setPreview(null);
      setError(err.message || 'Preview failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    setError('');
    setBusy(true);
    try {
      if (!file) throw new Error('Choose a CSV or Excel file first.');
      const batchId = preview?.batch?.id;
      if (!batchId) throw new Error('Preview the file before confirming.');
      if (!reconciliationId) throw new Error('Start a reconciliation before importing.');
      assertAllowedGuidedStatementFile(file.name);
      await confirmStatementImport(
        buildConfirmImportFormData({
          file,
          batchId,
          reconciliationId,
        })
      );
      await onConfirmed?.();
    } catch (err) {
      setError(err.message || 'Confirm failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!reconciliationId) {
    return (
      <p className="text-sm text-gray-600">
        {tt('Start or continue a reconciliation on the Statement step before importing.')}
      </p>
    );
  }

  const rows = preview?.previewRows || [];
  const balanceCheck = preview?.balanceCheck;
  const warnings = (
    Array.isArray(preview?.batch?.parseWarnings) && preview.batch.parseWarnings.length
      ? preview.batch.parseWarnings
      : balanceCheck?.warnings || []
  ).filter(Boolean);

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {existingCount > 0 ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
          {tt('This reconciliation already has')} {existingCount} {tt('imported statement line(s). You can import another CSV or Excel file, or continue to Match.')}
        </p>
      ) : null}

      <form onSubmit={handlePreview} className="space-y-4">
        <FormField
          label="Statement file"
          htmlFor="recon-import-file"
          hint="CSV or Excel only (.csv, .xlsx, .xls). OFX is not accepted here."
          required
        >
          {({ id, ...a11y }) => (
            <Input
              id={id}
              type="file"
              accept={GUIDED_IMPORT_ACCEPT}
              onChange={handleFileChange}
              {...a11y}
            />
          )}
        </FormField>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={busy} disabled={!file}>
            {tt('Preview')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={busy}
            disabled={!preview?.batch?.id || !file}
            onClick={handleConfirm}
          >
            {tt('Confirm import')}
          </Button>
        </div>
      </form>

      {preview ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            {tt('Showing')} {rows.length} {tt('of')} {preview.totalRows ?? rows.length} {tt('rows')}
            {preview.duplicateRowCount ? ` · ${preview.duplicateRowCount} ${tt('possible duplicates')}` : ''}
            {balanceCheck && balanceCheck.valid === false ? ` · ${tt('Balance check warning')}` : ''}
          </p>
          {warnings.length ? (
            <ul className="list-disc space-y-1 rounded-md border border-amber-200 bg-amber-50 px-5 py-2 text-sm text-amber-950">
              {warnings.map((warning) => (
                <li key={warning}>{tt(warning)}</li>
              ))}
            </ul>
          ) : null}
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">{tt('Date')}</th>
                  <th className="px-3 py-2 font-medium">{tt('Description')}</th>
                  <th className="px-3 py-2 font-medium">{tt('Reference')}</th>
                  <th className="px-3 py-2 font-medium text-right">{tt('Amount')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((row, index) => (
                    <tr key={row.rowFingerprint || `${row.lineNumber || index}`} className="border-t border-gray-100">
                      <td className="whitespace-nowrap px-3 py-2">{formatDate(row.transactionDate)}</td>
                      <td className="px-3 py-2">{row.description || ''}</td>
                      <td className="whitespace-nowrap px-3 py-2">{row.reference || ''}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatAmount(row)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-gray-500">
                      {tt('No rows in this preview.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
