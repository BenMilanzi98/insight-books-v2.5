/**
 * Onboarding report exports — Phase 17 Wave 4 / Phase 21 Wave 4 harden.
 * Permission recheck; strip credentials / migration file contents.
 * Portfolio / tenant fail-closed; query fail → UNAVAILABLE / rows null.
 */

import {
  canManageOnboarding,
  canViewOnboarding,
  hasCustomerOnboardingProjectModel,
  resolveOnboardingActor,
} from './model.js';
import { getOnboardingDomainContract } from './catalogue.js';
import { ONBOARDING_REPORT_CATALOGUE } from './reports.js';
import {
  resolveOnboardingListScope,
  tenantWhereFromScope,
} from './listScope.js';
import { ONBOARDING_REPORT_STATUS } from './reliabilityGate.js';
import { getOnboardingStatusLabelHonesty } from './honestyLabels.js';

const STRIP_KEYS = new Set([
  'mraApiKey',
  'credentialPassword',
  'password',
  'secret',
  'apiKey',
  'mraCredentials',
  'migrationFileContents',
  'migrationFile',
  'credentials',
  'token',
]);

function stripSensitive(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (STRIP_KEYS.has(k) || /password|credential|secret|api[_-]?key/i.test(k)) {
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

/** Neutralise CSV formula injection (=, +, -, @ prefixes). */
function csvCell(value) {
  const raw = value == null ? '' : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return JSON.stringify(safe);
}

function toCsv(rows) {
  const keys = ['onboardingNumber', 'status', 'tenantId', 'customerId', 'id'];
  if (!rows.length) return `${keys.join(',')}\n`;
  const header = keys.join(',');
  const lines = rows.map((r) => keys.map((k) => csvCell(r[k])).join(','));
  return [header, ...lines].join('\n');
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin?: object,
 *   reportKey?: string,
 *   format?: string,
 *   portfolioTenantIds?: string[],
 *   now?: Date,
 * }} args
 */
export async function exportOnboardingReport(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  // Permission recheck — export requires manage (Super Admin / manageCases)
  if (!canViewOnboarding(admin) || !canManageOnboarding(admin)) {
    return {
      ok: false,
      forbidden: true,
      error: 'onboarding_export_forbidden',
    };
  }

  const reportKey = String(args.reportKey || 'overview').trim().toLowerCase();
  if (!ONBOARDING_REPORT_CATALOGUE.some((r) => r.key === reportKey)) {
    return { ok: false, error: 'unknown_report_key', reportKey };
  }

  if (!hasCustomerOnboardingProjectModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_project_model_unavailable',
      status: ONBOARDING_REPORT_STATUS.UNAVAILABLE,
      rows: null,
      body: null,
    };
  }

  const scopeResult = await resolveOnboardingListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    return {
      ok: true,
      reportKey,
      format: String(args.format || 'csv').toLowerCase(),
      rows: [],
      body: toCsv([]),
      reason: scopeResult.reason,
      strippedCredentials: true,
      statusLabel: getOnboardingStatusLabelHonesty(),
      domain: getOnboardingDomainContract(),
      meta: { portfolioScoped: true, failClosed: true },
    };
  }

  const where = tenantWhereFromScope(scopeResult.tenantScope);
  const format = String(args.format || 'csv').toLowerCase();
  let rows;
  try {
    const raw = await prisma.customerOnboardingProject.findMany({ where });
    rows = (raw || []).map((r) =>
      stripSensitive({
        id: r.id,
        onboardingNumber: r.onboardingNumber,
        status: r.status,
        tenantId: r.tenantId,
        customerId: r.customerId,
        mraApiKey: r.mraApiKey,
        credentialPassword: r.credentialPassword,
        migrationFileContents: r.migrationFileContents,
      })
    );
  } catch {
    return {
      ok: false,
      error: 'export_query_failed',
      reason: 'onboarding_export_query_failed',
      status: ONBOARDING_REPORT_STATUS.UNAVAILABLE,
      reportKey,
      format,
      rows: null,
      body: null,
      strippedCredentials: true,
    };
  }

  const body = format === 'xlsx' || format === 'json' ? JSON.stringify(rows) : toCsv(rows);

  // Final sanitization pass
  if (/sk-live|hunter2|credentialPassword|mraApiKey|SECRET_FILE/i.test(body)) {
    return {
      ok: false,
      error: 'export_sanitization_failed',
      status: ONBOARDING_REPORT_STATUS.UNAVAILABLE,
      rows: null,
      body: null,
    };
  }

  return {
    ok: true,
    reportKey,
    format,
    rows,
    body,
    strippedCredentials: true,
    statusLabel: getOnboardingStatusLabelHonesty(),
    domain: getOnboardingDomainContract(),
    meta: { portfolioScoped: scopeResult.portfolioScoped },
  };
}
