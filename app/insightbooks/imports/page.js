'use client';

import { useState } from 'react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminErrorState,
  AdminEmptyState,
  AdminField,
} from '@/components/admin';

const btnPrimary = 'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';

export default function AdminImportsPage() {
  const [type, setType] = useState('tenants');
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const runDryRun = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/admin/imports/dry-run', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, rows: csvText }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok && !body.dryRun) {
        throw new Error(body.error || `Dry-run failed (${res.status})`);
      }
      setResult(body);
      if (!body.success && body.error && !body.errors) {
        setError(body.error);
      }
    } catch (e) {
      setError(e.message || 'Dry-run failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminPageContainer maxWidth="narrow">
      <AdminPageHeader
        title="Import dry-run"
        description="Validate tenant or user CSV rows without writing to the database (max 1000 rows)."
      />

      <div className="space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <AdminField label="Import type" htmlFor="import-type">
          <AdminField.Select
            id="import-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="tenants">Tenants</option>
            <option value="users">Users</option>
          </AdminField.Select>
        </AdminField>

        <AdminField
          label="CSV"
          htmlFor="import-csv"
          hint={
            type === 'tenants'
              ? 'Example: name,subdomain,status,subscriptionPlan'
              : 'Example: email,name,tenantId,role'
          }
        >
          <AdminField.Textarea
            id="import-csv"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={10}
            className="font-mono text-xs"
            placeholder={
              type === 'tenants'
                ? 'name,subdomain,status,subscriptionPlan\nAcme Ltd,acme,active,pro'
                : 'email,name,tenantId,role\nuser@example.com,Ada Lovelace,,User'
            }
          />
        </AdminField>

        <button
          type="button"
          onClick={runDryRun}
          disabled={loading || !csvText.trim()}
          className={btnPrimary}
        >
          {loading ? 'Validating…' : 'Run dry-run'}
        </button>
      </div>

      {error ? (
        <div className="mt-4">
          <AdminErrorState title="Dry-run failed" message={error} />
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-3 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <p className="text-sm text-[var(--admin-text-muted)]">
            {result.message || (result.ok ? 'Dry-run OK' : 'Dry-run has errors')} · persisted:{' '}
            {String(result.persisted === true)}
          </p>
          {Array.isArray(result.errors) && result.errors.length > 0 ? (
            <ul className="max-h-48 space-y-1 overflow-auto text-sm text-[var(--admin-danger)]">
              {result.errors.slice(0, 50).map((err, i) => (
                <li key={`${err.row}-${err.field}-${i}`}>
                  Row {err.row}
                  {err.field ? ` · ${err.field}` : ''}: {err.message}
                </li>
              ))}
            </ul>
          ) : (
            <AdminEmptyState
              title="No validation errors"
              description={`${result.rowCount ?? 0} row(s) validated. Preview shows up to 50 rows.`}
            />
          )}
          {Array.isArray(result.preview) && result.preview.length > 0 ? (
            <pre className="max-h-64 overflow-auto rounded-[var(--admin-radius)] bg-[var(--admin-surface-muted)] p-3 text-xs text-[var(--admin-text)]">
              {JSON.stringify(result.preview, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
