"use client";
import { tt } from '@/lib/i18n/runtime';

/**
 * Chart of Accounts — Governance Console (Phase 3).
 *
 * Additive admin surface over the V2 governance APIs: integrity validation,
 * purpose mappings, duplicate candidates, consolidation plans, and versioned
 * templates. The classic Chart of Accounts page remains unchanged.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Copy,
  GitMerge,
  LayoutTemplate,
  Link2,
  RefreshCw,
  FileDown,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import PermissionGuard from '@/components/PermissionGuard';

const TABS = [
  { id: 'validation', label: 'Validation', icon: ShieldCheck },
  { id: 'mappings', label: 'Purpose Mappings', icon: Link2 },
  { id: 'duplicates', label: 'Duplicates', icon: Copy },
  { id: 'consolidation', label: 'Consolidation Plans', icon: GitMerge },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
];

const SEVERITY_STYLE = {
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-blue-100 text-blue-800',
  INFO: 'bg-gray-100 text-gray-700',
};

const STATUS_STYLE = {
  ACTIVE: 'bg-green-100 text-green-800',
  DEPRECATED: 'bg-amber-100 text-amber-800',
  ARCHIVED: 'bg-gray-200 text-gray-700',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  EXECUTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

function Badge({ value, styles = STATUS_STYLE }) {
  if (!value) return <span className="text-gray-400">—</span>;
  const cls = styles[value] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {value}
    </span>
  );
}

function SectionCard({ title, subtitle, actions, children }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {subtitle ? <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function LoadingRow({ colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6 text-center text-sm text-gray-500">
        {tt('Loading…')}
      </td>
    </tr>
  );
}

function EmptyRow({ colSpan, text }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6 text-center text-sm text-gray-400">
        {text}
      </td>
    </tr>
  );
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `Request failed (${res.status})`);
  }
  return body;
}

/* ------------------------------ Validation tab ------------------------------ */

function ValidationTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchJson('/api/coa-v2/validate'));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { run(); }, [run]);

  return (
    <SectionCard
      title="Chart of Accounts integrity"
      subtitle="Runs the COA-001 … COA-025 integrity checks for this business"
      actions={
        <button
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {tt('Re-run validation')}
        </button>
      }
    >
      {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
      {data ? (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="px-3 py-2 rounded-md bg-gray-50 border border-gray-200">
              <div className="text-xs text-gray-500">{tt('Findings')}</div>
              <div className="text-lg font-semibold text-gray-900">{data.findingCount}</div>
            </div>
            {Object.entries(data.bySeverity ?? {}).map(([sev, count]) => (
              <div key={sev} className="px-3 py-2 rounded-md bg-gray-50 border border-gray-200">
                <div className="text-xs text-gray-500">{sev}</div>
                <div className="text-lg font-semibold text-gray-900">{count}</div>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
                  <th className="px-3 py-2">{tt('Check')}</th>
                  <th className="px-3 py-2">{tt('Severity')}</th>
                  <th className="px-3 py-2">{tt('Description')}</th>
                  <th className="px-3 py-2">{tt('Recommendation')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <LoadingRow colSpan={4} />
                ) : (data.findings ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center">
                      <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
                      <span className="text-sm text-gray-600">{tt('No integrity issues detected.')}</span>
                    </td>
                  </tr>
                ) : (
                  data.findings.map((f, i) => (
                    <tr key={i} className="align-top">
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{f.ruleCode}</td>
                      <td className="px-3 py-2"><Badge value={f.severity} styles={SEVERITY_STYLE} /></td>
                      <td className="px-3 py-2 text-gray-800">{f.description}</td>
                      <td className="px-3 py-2 text-gray-500">{f.recommendation ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : loading ? (
        <p className="text-sm text-gray-500">{tt('Running integrity checks…')}</p>
      ) : null}
    </SectionCard>
  );
}

/* ------------------------------ Mappings tab ------------------------------ */

function MappingsTab() {
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await fetchJson('/api/coa-v2/mappings');
      setMappings(body.mappings ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const retire = async (id) => {
    if (!window.confirm('Retire this mapping? Future postings will stop resolving through it.')) return;
    setNotice(null);
    try {
      await fetchJson(`/api/coa-v2/mappings/${id}`, { method: 'DELETE' });
      setNotice('Mapping retired.');
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <SectionCard
      title="System purpose mappings"
      subtitle="Each active purpose resolves to exactly one approved account for this business"
      actions={
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="w-3.5 h-3.5" /> {tt('Refresh')}
        </button>
      }
    >
      {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
      {notice ? <p className="text-sm text-green-700 mb-3">{notice}</p> : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
              <th className="px-3 py-2">{tt('Purpose')}</th>
              <th className="px-3 py-2">{tt('Account')}</th>
              <th className="px-3 py-2">{tt('Scope')}</th>
              <th className="px-3 py-2">{tt('Status')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <LoadingRow colSpan={5} />
            ) : mappings.length === 0 ? (
              <EmptyRow
                colSpan={5}
                text="No registry mappings yet. Purposes currently resolve through the legacy blueprint fallback."
              />
            ) : (
              mappings.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{m.purpose}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-gray-900">{m.account?.accountCode}</span>{' '}
                    <span className="text-gray-600">{m.account?.accountName}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {[m.moduleKey, m.transactionType, m.currency, m.branchKey]
                      .map((v) => (v === '*' ? 'any' : v))
                      .join(' / ')}
                  </td>
                  <td className="px-3 py-2"><Badge value={m.status} /></td>
                  <td className="px-3 py-2 text-right">
                    {m.status === 'ACTIVE' ? (
                      <button
                        onClick={() => retire(m.id)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        {tt('Retire')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/* ------------------------------ Duplicates tab ------------------------------ */

function DuplicatesTab({ onCreatePlan }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const body = await fetchJson('/api/coa-v2/duplicates');
        setRows(body.candidates ?? []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <SectionCard
      title="Duplicate account candidates"
      subtitle="Classified for review — accounts are never merged or deleted automatically"
    >
      {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
              <th className="px-3 py-2">{tt('Code')}</th>
              <th className="px-3 py-2">{tt('Name')}</th>
              <th className="px-3 py-2">{tt('Class')}</th>
              <th className="px-3 py-2">{tt('Activity')}</th>
              <th className="px-3 py-2">{tt('Proposed action')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <LoadingRow colSpan={6} />
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={6} text="No duplicate candidates detected for this business." />
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.accountId}-${i}`} className="align-top">
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{r.code}</td>
                  <td className="px-3 py-2 text-gray-800">{r.name}</td>
                  <td className="px-3 py-2">
                    <Badge value={r.duplicateClass} styles={{}} />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {(r.journalLineCount ?? 0)} lines
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{r.proposedAction ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {r.proposedCanonicalAccountId && r.proposedCanonicalAccountId !== r.accountId ? (
                      <button
                        onClick={() => onCreatePlan(r)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                      >
                        {tt('Create plan')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/* ------------------------------ Consolidation tab ------------------------------ */

function ConsolidationTab({ refreshKey }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await fetchJson('/api/coa-v2/consolidation-plans');
      setPlans(body.plans ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const act = async (id, action) => {
    setNotice(null);
    setError(null);
    try {
      const body = await fetchJson(`/api/coa-v2/consolidation-plans/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setNotice(body.message);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <SectionCard
      title="Consolidation plans"
      subtitle="Approval by a different user is required; execution deprecates the duplicate for future postings only"
      actions={
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="w-3.5 h-3.5" /> {tt('Refresh')}
        </button>
      }
    >
      {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
      {notice ? <p className="text-sm text-green-700 mb-3">{notice}</p> : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
              <th className="px-3 py-2">{tt('Duplicate')}</th>
              <th className="px-3 py-2">{tt('Canonical')}</th>
              <th className="px-3 py-2">{tt('Status')}</th>
              <th className="px-3 py-2">{tt('Phase 6 repair')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <LoadingRow colSpan={5} />
            ) : plans.length === 0 ? (
              <EmptyRow colSpan={5} text="No consolidation plans." />
            ) : (
              plans.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs">{p.duplicateAccount?.accountCode}</span>{' '}
                    <span className="text-gray-700">{p.duplicateAccount?.accountName}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs">{p.canonicalAccount?.accountCode}</span>{' '}
                    <span className="text-gray-700">{p.canonicalAccount?.accountName}</span>
                  </td>
                  <td className="px-3 py-2"><Badge value={p.status} /></td>
                  <td className="px-3 py-2">
                    {p.phase6RepairRequired ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                        <AlertTriangle className="w-3.5 h-3.5" /> {tt('Required')}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">{tt('No')}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right space-x-3 whitespace-nowrap">
                    {p.status === 'PENDING_APPROVAL' ? (
                      <button
                        onClick={() => act(p.id, 'approve')}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {tt('Approve')}
                      </button>
                    ) : null}
                    {p.status === 'APPROVED' ? (
                      <button
                        onClick={() => act(p.id, 'execute')}
                        className="text-xs text-green-700 hover:text-green-900 font-medium"
                      >
                        {tt('Execute')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/* ------------------------------ Templates tab ------------------------------ */

function TemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [compareKey, setCompareKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [selectedCodes, setSelectedCodes] = useState(new Set());

  useEffect(() => {
    (async () => {
      try {
        const body = await fetchJson('/api/coa-v2/templates');
        setTemplates(body.templates ?? []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const preview = async (templateKey, version) => {
    setError(null);
    setNotice(null);
    setComparison(null);
    setSelectedCodes(new Set());
    setCompareKey(`${templateKey}:${version}`);
    try {
      const body = await fetchJson(
        `/api/coa-v2/templates?compare=${encodeURIComponent(templateKey)}&version=${version}`
      );
      setComparison(body.comparison);
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleCode = (code) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const applySelected = async () => {
    if (!comparison || selectedCodes.size === 0) return;
    setError(null);
    setNotice(null);
    try {
      const body = await fetchJson('/api/coa-v2/templates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey: comparison.templateKey,
          version: comparison.version,
          codes: [...selectedCodes],
        }),
      });
      setNotice(body.message);
      await preview(comparison.templateKey, comparison.version);
    } catch (e) {
      setError(e.message);
    }
  };

  const missing = useMemo(
    () => (comparison ? [...comparison.missingRequired, ...comparison.missingOptional] : []),
    [comparison]
  );

  return (
    <SectionCard
      title="Versioned Chart of Accounts templates"
      subtitle="Templates are immutable after publication; applying additions never overwrites existing accounts"
    >
      {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
      {notice ? <p className="text-sm text-green-700 mb-3">{notice}</p> : null}
      <div className="overflow-x-auto mb-4">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
              <th className="px-3 py-2">{tt('Template')}</th>
              <th className="px-3 py-2">{tt('Version')}</th>
              <th className="px-3 py-2">{tt('Business type')}</th>
              <th className="px-3 py-2">{tt('Accounts')}</th>
              <th className="px-3 py-2">{tt('Status')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <LoadingRow colSpan={6} />
            ) : templates.length === 0 ? (
              <EmptyRow colSpan={6} text="No templates registered. Run: npm run coa:seed-templates" />
            ) : (
              templates.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2 font-medium text-gray-900">{t.name}</td>
                  <td className="px-3 py-2">v{t.version}</td>
                  <td className="px-3 py-2 text-gray-600">{t.businessType}</td>
                  <td className="px-3 py-2">{t._count?.accounts ?? '—'}</td>
                  <td className="px-3 py-2"><Badge value={t.status} styles={{ PUBLISHED: 'bg-green-100 text-green-800' }} /></td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => preview(t.templateKey, t.version)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {compareKey === `${t.templateKey}:${t.version}` ? 'Refresh preview' : 'Preview vs business'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {comparison ? (
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Comparison — {comparison.templateKey} v{comparison.version}
            </h3>
            <button
              onClick={applySelected}
              disabled={selectedCodes.size === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
            >
              Apply {selectedCodes.size} selected addition{selectedCodes.size === 1 ? '' : 's'}
            </button>
          </div>
          <div className="flex flex-wrap gap-3 mb-3 text-xs text-gray-600">
            <span>{tt('Present:')} <strong>{comparison.counts.present}</strong></span>
            <span>{tt('Missing required:')} <strong>{comparison.counts.missingRequired}</strong></span>
            <span>{tt('Missing optional:')} <strong>{comparison.counts.missingOptional}</strong></span>
            <span>{tt('Business custom:')} <strong>{comparison.counts.businessCustom}</strong></span>
          </div>
          {missing.length === 0 ? (
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" /> {tt('This business already has every template account.')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
                    <th className="px-3 py-2" />
                    <th className="px-3 py-2">{tt('Code')}</th>
                    <th className="px-3 py-2">{tt('Name')}</th>
                    <th className="px-3 py-2">{tt('Category')}</th>
                    <th className="px-3 py-2">{tt('Behaviour')}</th>
                    <th className="px-3 py-2">{tt('Required')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {missing.map((a) => (
                    <tr key={a.code}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedCodes.has(a.code)}
                          onChange={() => toggleCode(a.code)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{a.code}</td>
                      <td className="px-3 py-2 text-gray-800">{a.name}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">{a.category}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">{a.behaviour}</td>
                      <td className="px-3 py-2">
                        {a.required ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-300" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </SectionCard>
  );
}

/* ------------------------------ Page shell ------------------------------ */

export default function CoaGovernancePage() {
  const [activeTab, setActiveTab] = useState('validation');
  const [planRefreshKey, setPlanRefreshKey] = useState(0);
  const [planNotice, setPlanNotice] = useState(null);

  const createPlanFromDuplicate = async (row) => {
    const reason = window.prompt(
      `Create a consolidation plan for ${row.code} — ${row.name}?\nEnter a reason:`
    );
    if (!reason) return;
    try {
      await fetchJson('/api/coa-v2/consolidation-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duplicateAccountId: row.accountId,
          canonicalAccountId: row.proposedCanonicalAccountId,
          duplicateClass: row.duplicateClass,
          reason,
        }),
      });
      setPlanNotice('Consolidation plan created (pending approval).');
      setPlanRefreshKey((k) => k + 1);
      setActiveTab('consolidation');
    } catch (e) {
      setPlanNotice(`Failed to create plan: ${e.message}`);
    }
  };

  return (
    <PermissionGuard permissions={['coa.view', 'accounts.view']}>
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{tt('Chart of Accounts Governance')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {tt('Integrity validation, purpose mappings, duplicate control, and templates. Historical journals are never modified from this console.')}
            </p>
          </div>
          <a
            href="/api/coa-v2/export"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            <FileDown className="w-3.5 h-3.5" /> {tt('Export CSV')}
          </a>
        </div>

        {planNotice ? (
          <div className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
            {planNotice}
          </div>
        ) : null}

        <div className="flex gap-1 border-b border-gray-200">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  active
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'validation' ? <ValidationTab /> : null}
        {activeTab === 'mappings' ? <MappingsTab /> : null}
        {activeTab === 'duplicates' ? <DuplicatesTab onCreatePlan={createPlanFromDuplicate} /> : null}
        {activeTab === 'consolidation' ? <ConsolidationTab refreshKey={planRefreshKey} /> : null}
        {activeTab === 'templates' ? <TemplatesTab /> : null}
      </div>
    </PermissionGuard>
  );
}
