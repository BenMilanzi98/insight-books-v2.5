/**
 * Accounting Audit Service — Phase 1 forensic audit orchestrator.
 * READ-ONLY: no function in this module writes accounting data.
 */

import crypto from 'crypto';
import { runJournalIntegrityAudit } from './journalIntegrityAudit.js';
import { runLedgerReconciliationAudit } from './ledgerReconciliationAudit.js';
import { runTrialBalanceAudit } from './trialBalanceAudit.js';
import { runSourceLinkageAudit } from './sourceLinkageAudit.js';
import { runChartOfAccountsAudit } from './chartOfAccountsAudit.js';
import { runPeriodsAudit, runReversalsAudit } from './periodsReversalsAudit.js';
import { runCapitalEquityAudit } from './capitalEquityAudit.js';
import { runArApReconciliationAudit } from './arApReconciliationAudit.js';
import { runArchitectureIntegrityAudit } from './architectureIntegrityAudit.js';
import { runCoaIntegrityAudit } from './coaIntegrityAudit.js';

export const AUDIT_MODULES = Object.freeze({
  journals: runJournalIntegrityAudit,
  ledger: runLedgerReconciliationAudit,
  'trial-balance': runTrialBalanceAudit,
  sources: runSourceLinkageAudit,
  coa: runChartOfAccountsAudit,
  'coa-v2': runCoaIntegrityAudit,
  periods: runPeriodsAudit,
  reversals: runReversalsAudit,
  capital: runCapitalEquityAudit,
  'ar-ap': runArApReconciliationAudit,
  architecture: runArchitectureIntegrityAudit,
});

/**
 * Run the forensic audit.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} options
 * @param {string|null} [options.tenantId]
 * @param {Date|null} [options.from]
 * @param {Date|null} [options.to]
 * @param {string[]} [options.modules] subset of AUDIT_MODULES keys; default all
 * @returns {Promise<{ runId: string, startedAt: string, finishedAt: string, scope: object, summary: object, findings: Array, artifacts: object }>}
 */
export async function runAccountingAudit(prisma, options = {}) {
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const scope = {
    tenantId: options.tenantId ?? null,
    from: options.from ?? null,
    to: options.to ?? null,
  };

  const moduleKeys = options.modules?.length
    ? options.modules.filter((m) => AUDIT_MODULES[m])
    : Object.keys(AUDIT_MODULES);

  const findings = [];
  const artifacts = {};

  for (const key of moduleKeys) {
    const result = await AUDIT_MODULES[key](prisma, scope);
    const moduleFindings = (result.findings || []).map((f, i) => ({
      findingId: `${runId.slice(0, 8)}-${key}-${i + 1}`,
      auditRunId: runId,
      auditModule: key,
      ...f,
    }));
    findings.push(...moduleFindings);
    const { findings: _drop, ...rest } = result;
    artifacts[key] = rest;
  }

  const bySeverity = {};
  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  }

  return {
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    scope,
    summary: {
      modulesRun: moduleKeys,
      totalFindings: findings.length,
      bySeverity,
    },
    findings,
    artifacts,
  };
}
