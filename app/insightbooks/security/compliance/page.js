'use client';
import { tt } from '@/lib/i18n/runtime';

import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Download,
  Eye,
  FileText,
  Info,
  RefreshCw,
  Shield,
  XCircle,
} from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminEmptyState,
  AdminSummaryCard,
  AdminStatusBadge,
} from '@/components/admin';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const inputCls =
  'rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-text)]';
const sectionCls =
  'rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)]';

function policyTone(status) {
  if (status === 'compliant') return 'success';
  if (status === 'non-compliant') return 'danger';
  if (status === 'partial') return 'warning';
  return 'neutral';
}

function PolicyIcon({ status }) {
  if (status === 'compliant') {
    return <CheckCircle className="h-5 w-5 text-[var(--status-success)]" aria-hidden />;
  }
  if (status === 'non-compliant') {
    return <XCircle className="h-5 w-5 text-[var(--status-danger)]" aria-hidden />;
  }
  if (status === 'partial') {
    return <AlertTriangle className="h-5 w-5 text-[var(--status-warning)]" aria-hidden />;
  }
  return <Info className="h-5 w-5 text-[var(--admin-text-muted)]" aria-hidden />;
}

function scoreTone(score) {
  if (score == null) return 'neutral';
  if (score >= 90) return 'success';
  if (score >= 70) return 'warning';
  return 'danger';
}

export default function SecurityCompliancePage() {
  const { t } = useI18n();
  const [complianceData, setComplianceData] = useState({
    overallScore: null,
    policies: [],
    auditRequirements: [],
    lastAssessment: null,
    nextAssessment: null,
    scoreNote: null,
  });
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFramework, setSelectedFramework] = useState('general');

  const fetchComplianceData = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError('');
      const response = await adminFetch(`/api/admin/security/compliance?framework=${selectedFramework}`,
        { credentials: 'include' }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Failed to load (${response.status})`);
      }
      setComplianceData(
        data.compliance || {
          overallScore: null,
          policies: [],
          auditRequirements: [],
          lastAssessment: null,
          nextAssessment: null,
        }
      );
    } catch (error) {
      setLoadError(error.message || 'Failed to load compliance signals');
      setComplianceData({
        overallScore: null,
        policies: [],
        auditRequirements: [],
        lastAssessment: null,
        nextAssessment: null,
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedFramework]);

  useEffect(() => {
    fetchComplianceData();
  }, [fetchComplianceData]);

  const exportComplianceReport = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Policy,Status,Description,Last Reviewed\n' +
      (complianceData.policies || [])
        .map(
          (policy) =>
            `${policy.name},${policy.status},${policy.description},${policy.lastReviewed || 'N/A'}`
        )
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `compliance_report_${selectedFramework}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const policies = complianceData.policies || [];
  const compliantCount = policies.filter((p) => p.status === 'compliant').length;
  const partialCount = policies.filter((p) => p.status === 'partial').length;
  const nonCompliantCount = policies.filter((p) => p.status === 'non-compliant').length;

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.security.compliance.title')}
        description="Compliance signals and policy adherence from the compliance API. Scores and lists are shown only when returned by the server."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedFramework}
              onChange={(e) => setSelectedFramework(e.target.value)}
              className={inputCls}
              aria-label={tt('Framework')}
            >
              <option value="general">{tt('General Security')}</option>
              <option value="gdpr">GDPR</option>
              <option value="sox">SOX</option>
              <option value="iso27001">{tt('ISO 27001')}</option>
              <option value="pci">{tt('PCI DSS')}</option>
            </select>
            <button type="button" onClick={exportComplianceReport} className={btnGhost}>
              <Download className="h-4 w-4" aria-hidden />
              {tt('Export report')}
            </button>
            <button type="button" onClick={fetchComplianceData} className={btnGhost}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              {tt('Refresh')}
            </button>
          </div>
        }
      />

      {isLoading ? <AdminLoadingState label="Loading compliance" /> : null}
      {!isLoading && loadError && policies.length === 0 && complianceData.overallScore == null ? (
        <AdminErrorState
          title="Compliance unavailable"
          message={loadError}
          onRetry={fetchComplianceData}
        />
      ) : null}

      {!isLoading && !(loadError && policies.length === 0 && complianceData.overallScore == null) ? (
        <div className="space-y-6">
          {loadError ? (
            <div
              role="status"
              className="rounded-[var(--admin-radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              {loadError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminSummaryCard
              label="Overall score"
              value={
                complianceData.overallScore == null ? '—' : `${complianceData.overallScore}%`
              }
              hint={complianceData.scoreNote || undefined}
              icon={Shield}
              tone={scoreTone(complianceData.overallScore)}
            />
            <AdminSummaryCard
              label="Compliant"
              value={compliantCount}
              icon={CheckCircle}
              tone="success"
            />
            <AdminSummaryCard
              label="Partial"
              value={partialCount}
              icon={AlertTriangle}
              tone="warning"
            />
            <AdminSummaryCard
              label="Non-compliant"
              value={nonCompliantCount}
              icon={XCircle}
              tone="danger"
            />
          </div>

          <section className={sectionCls}>
            <div className="flex items-center gap-2 border-b border-[var(--admin-border)] px-4 py-3 sm:px-6">
              <Calendar className="h-5 w-5 text-[var(--admin-text-muted)]" aria-hidden />
              <h2 className="text-base font-semibold text-[var(--admin-text)]">
                {tt('Assessment timeline')}
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 p-4 sm:grid-cols-2 sm:p-6">
              <div>
                <h3 className="text-sm font-medium text-[var(--admin-text-muted)]">
                  {tt('Last assessment')}
                </h3>
                <p className="mt-1 text-lg font-semibold text-[var(--admin-text)]">
                  {complianceData.lastAssessment
                    ? new Date(complianceData.lastAssessment).toLocaleDateString()
                    : 'Not available'}
                </p>
                <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
                  Score:{' '}
                  {complianceData.overallScore == null
                    ? 'n/a'
                    : `${complianceData.overallScore}%`}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-[var(--admin-text-muted)]">
                  {tt('Next assessment')}
                </h3>
                <p className="mt-1 text-lg font-semibold text-[var(--admin-text)]">
                  {complianceData.nextAssessment
                    ? new Date(complianceData.nextAssessment).toLocaleDateString()
                    : 'Not scheduled'}
                </p>
                <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
                  {complianceData.nextAssessment
                    ? `${Math.ceil(
                        (new Date(complianceData.nextAssessment) - new Date()) /
                          (1000 * 60 * 60 * 24)
                      )} days remaining`
                    : 'Schedule required'}
                </p>
              </div>
            </div>
          </section>

          <section className={sectionCls}>
            <div className="flex items-center gap-2 border-b border-[var(--admin-border)] px-4 py-3 sm:px-6">
              <FileText className="h-5 w-5 text-[var(--admin-text-muted)]" aria-hidden />
              <h2 className="text-base font-semibold text-[var(--admin-text)]">
                {tt('Policy compliance')}
              </h2>
            </div>
            <div className="p-4 sm:p-6">
              {policies.length > 0 ? (
                <ul className="space-y-3">
                  {policies.map((policy, index) => (
                    <li
                      key={policy.id || index}
                      className="flex flex-col gap-3 rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <PolicyIcon status={policy.status} />
                        <div>
                          <h3 className="text-sm font-medium text-[var(--admin-text)]">
                            {policy.name}
                          </h3>
                          <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
                            {policy.description}
                          </p>
                          {policy.lastReviewed ? (
                            <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
                              Last reviewed:{' '}
                              {new Date(policy.lastReviewed).toLocaleDateString()}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <AdminStatusBadge tone={policyTone(policy.status)}>
                          {String(policy.status || 'unknown').replace('-', ' ')}
                        </AdminStatusBadge>
                        {policy.requirements ? (
                          <span className="text-xs text-[var(--admin-text-muted)]">
                            {policy.requirements.length} requirements
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <AdminEmptyState
                  title="No policies found"
                  description="Policies will appear here once the compliance API returns them."
                />
              )}
            </div>
          </section>

          <section className={sectionCls}>
            <div className="flex items-center gap-2 border-b border-[var(--admin-border)] px-4 py-3 sm:px-6">
              <Eye className="h-5 w-5 text-[var(--admin-text-muted)]" aria-hidden />
              <h2 className="text-base font-semibold text-[var(--admin-text)]">
                {tt('Audit requirements')}
              </h2>
            </div>
            <div className="p-4 sm:p-6">
              {(complianceData.auditRequirements || []).length > 0 ? (
                <ul className="space-y-3">
                  {complianceData.auditRequirements.map((requirement, index) => (
                    <li
                      key={requirement.id || index}
                      className="flex flex-col gap-3 rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <h3 className="text-sm font-medium text-[var(--admin-text)]">
                          {requirement.name}
                        </h3>
                        <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
                          {requirement.description}
                        </p>
                        {requirement.dueDate ? (
                          <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
                            Due: {new Date(requirement.dueDate).toLocaleDateString()}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <AdminStatusBadge
                          tone={
                            requirement.status === 'completed'
                              ? 'success'
                              : requirement.status === 'in-progress'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {String(requirement.status || 'pending').replace('-', ' ')}
                        </AdminStatusBadge>
                        {requirement.priority ? (
                          <AdminStatusBadge
                            tone={
                              requirement.priority === 'high'
                                ? 'danger'
                                : requirement.priority === 'medium'
                                  ? 'warning'
                                  : 'success'
                            }
                          >
                            {requirement.priority}
                          </AdminStatusBadge>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <AdminEmptyState
                  title="No audit requirements"
                  description="Audit requirements will appear when returned by the API."
                />
              )}
            </div>
          </section>

          {complianceData.overallScore != null && complianceData.overallScore < 90 ? (
            <div className="rounded-[var(--admin-radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Current compliance score is {complianceData.overallScore}%. Focus on non-compliant
              policies returned above to improve coverage.
            </div>
          ) : null}
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
