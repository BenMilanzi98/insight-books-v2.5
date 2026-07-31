/**
 * Adoption report exports — Phase 19 Wave 4.
 * Permission recheck; strip secrets / tokens.
 * Portfolio-scoped for non–Super Admin (fail-closed empty scope).
 */

import {
  canManageAdoption,
  canViewAdoption,
  hasCustomerAdoptionPlanModel,
  resolveAdoptionActor,
} from './model.js';
import { getAdoptionDomainContract } from './catalogue.js';
import { ADOPTION_REPORT_CATALOGUE } from './reports.js';
import {
  resolveAdoptionListScope,
  tenantWhereFromScope,
} from './listScope.js';
import { ADOPTION_REPORT_STATUS } from './reliabilityGate.js';

const STRIP_KEYS = new Set([
  'accessToken',
  'token',
  'secret',
  'secretNote',
  'password',
  'apiKey',
  'credentials',
]);

function stripSensitive(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (
      STRIP_KEYS.has(k) ||
      /password|credential|secret|token/i.test(k)
    ) {
      continue;
    }
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      out[k] = stripSensitive(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function toCsv(rows) {
  if (!rows.length) return 'planNumber,status,tenantId,customerId\n';
  const keys = ['planNumber', 'status', 'tenantId', 'customerId', 'id'];
  const header = keys.join(',');
  const lines = rows.map((r) =>
    keys.map((k) => JSON.stringify(r[k] ?? '')).join(',')
  );
  return [header, ...lines].join('\n');
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, reportKey?: string, format?: string, portfolioTenantIds?: string[] }} args
 */
export async function exportAdoptionReport(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canViewAdoption(admin) || !canManageAdoption(admin)) {
    return {
      ok: false,
      forbidden: true,
      error: 'adoption_export_forbidden',
    };
  }

  const reportKey = String(args.reportKey || 'overview').trim().toLowerCase();
  if (!ADOPTION_REPORT_CATALOGUE.some((r) => r.key === reportKey)) {
    return { ok: false, error: 'unknown_report_key', reportKey };
  }

  if (!hasCustomerAdoptionPlanModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_plan_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const scopeResult = await resolveAdoptionListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    return {
      ok: true,
      reportKey,
      format: String(args.format || 'csv').toLowerCase(),
      rows: [],
      body: toCsv([]),
      reason: scopeResult.reason,
      strippedSecrets: true,
      strippedTokens: true,
      domain: getAdoptionDomainContract(),
      meta: { portfolioScoped: true, failClosed: true },
    };
  }

  const where = { ...tenantWhereFromScope(scopeResult.tenantScope) };
  const format = String(args.format || 'csv').toLowerCase();
  let rows;
  try {
    rows = await prisma.customerAdoptionPlan.findMany({ where });
  } catch {
    // Query failure → UNAVAILABLE (never empty success / false-empty portfolio).
    return {
      ok: false,
      error: 'export_query_failed',
      reason: 'adoption_export_query_failed',
      status: ADOPTION_REPORT_STATUS.UNAVAILABLE,
      reportKey,
      format,
      rows: null,
      body: null,
      strippedSecrets: true,
      strippedTokens: true,
      domain: getAdoptionDomainContract(),
      meta: {
        portfolioScoped: scopeResult.portfolioScoped,
        queryFailed: true,
      },
    };
  }

  const sanitized = (rows || []).map((r) =>
    stripSensitive({
      id: r.id,
      planNumber: r.planNumber,
      status: r.status,
      tenantId: r.tenantId,
      customerId: r.customerId,
    })
  );

  return {
    ok: true,
    reportKey,
    format,
    rows: sanitized,
    body: format === 'json' ? JSON.stringify(sanitized) : toCsv(sanitized),
    strippedSecrets: true,
    strippedTokens: true,
    domain: getAdoptionDomainContract(),
    meta: { portfolioScoped: scopeResult.portfolioScoped },
  };
}
