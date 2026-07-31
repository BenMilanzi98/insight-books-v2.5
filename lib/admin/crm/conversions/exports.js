/**
 * Conversion report exports — Phase 20 Wave 4.
 * Permission recheck; strip secrets / tokens; formula-injection neutralised.
 * Sales-team / territory / customer / tenant fail-closed.
 */

import { resolveCrmAccess } from '../authz.js';
import { hasCrmConversionModel } from './model.js';
import { getConversionDomainContract } from './catalogue.js';
import {
  resolveConversionListScope,
  whereFromConversionScope,
} from './listScope.js';
import { CRM_CONVERSION_REPORT_STATUS } from './reliabilityGate.js';
import { getConversionValueLabelHonesty } from './valueLabels.js';

const STRIP_KEYS = new Set([
  'accessToken',
  'token',
  'secret',
  'secretNote',
  'password',
  'apiKey',
  'credentials',
]);

const EXPORT_REPORT_KEYS = new Set(['overview', 'conversions', 'requests']);

function stripSensitive(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (STRIP_KEYS.has(k) || /password|credential|secret|token/i.test(k)) {
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
  const keys = [
    'id',
    'conversionNumber',
    'status',
    'tenantId',
    'customerId',
    'teamId',
    'territoryId',
  ];
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
 *   tenantIds?: string[],
 *   customerIds?: string[],
 *   salesTeamIds?: string[],
 *   teamIds?: string[],
 *   territoryIds?: string[],
 * }} args
 */
export async function exportConversionReport(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canExport &&
    !access.canViewOpportunities &&
    !access.isSuperAdmin
  ) {
    return {
      ok: false,
      forbidden: true,
      error: 'conversion_export_forbidden',
    };
  }

  const reportKey = String(args.reportKey || 'overview').trim().toLowerCase();
  if (!EXPORT_REPORT_KEYS.has(reportKey)) {
    return { ok: false, error: 'unknown_report_key', reportKey };
  }

  if (!hasCrmConversionModel(prisma)) {
    return {
      ok: false,
      error: 'crm_conversion_model_unavailable',
      status: CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE,
    };
  }

  const scopeResult = await resolveConversionListScope(prisma, args.admin, args);
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
      valueLabel: getConversionValueLabelHonesty(),
      domain: getConversionDomainContract(),
      meta: { portfolioScoped: true, failClosed: true },
    };
  }

  const where = whereFromConversionScope(scopeResult);
  const format = String(args.format || 'csv').toLowerCase();
  let rows;
  try {
    rows = await prisma.crmConversion.findMany({ where });
  } catch {
    return {
      ok: false,
      error: 'export_query_failed',
      reason: 'conversion_export_query_failed',
      status: CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE,
      reportKey,
      format,
      rows: null,
      body: null,
      strippedSecrets: true,
      strippedTokens: true,
      domain: getConversionDomainContract(),
      meta: {
        portfolioScoped: scopeResult.portfolioScoped,
        queryFailed: true,
      },
    };
  }

  const sanitized = (rows || []).map((r) =>
    stripSensitive({
      id: r.id,
      conversionNumber: r.conversionNumber,
      status: r.status,
      tenantId: r.tenantId || null,
      customerId: r.customerId || null,
      teamId: r.teamId || null,
      territoryId: r.territoryId || null,
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
    formulaInjectionNeutralised: true,
    valueLabel: getConversionValueLabelHonesty(),
    domain: getConversionDomainContract(),
    meta: { portfolioScoped: scopeResult.portfolioScoped },
  };
}
