/**
 * Training report exports — Phase 22 Wave 4 harden.
 * Permission recheck; strip answers / tokens / restricted materials.
 * Portfolio-scoped for non–Super Admin (fail-closed empty scope).
 * Query fail → UNAVAILABLE / rows+body null (never empty success).
 */

import {
  canManageTraining,
  canViewTraining,
  hasCustomerTrainingProgramModel,
  resolveTrainingActor,
} from './model.js';
import { getTrainingDomainContract } from './catalogue.js';
import { TRAINING_REPORT_CATALOGUE } from './reports.js';
import {
  resolveTrainingListScope,
  tenantWhereFromScope,
} from './listScope.js';

const STRIP_KEYS = new Set([
  'answerPayload',
  'assessmentAnswersJson',
  'answers',
  'accessToken',
  'token',
  'secret',
  'password',
  'apiKey',
  'restrictedMaterialBody',
  'restrictedMaterials',
  'questionBank',
  'credentials',
]);

function stripSensitive(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (
      STRIP_KEYS.has(k) ||
      /password|credential|secret|token|answer|restricted/i.test(k)
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
  if (!rows.length) return 'programNumber,status,tenantId,customerId\n';
  const keys = ['programNumber', 'status', 'tenantId', 'customerId', 'id'];
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
export async function exportTrainingReport(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canViewTraining(admin) || !canManageTraining(admin)) {
    return {
      ok: false,
      forbidden: true,
      error: 'training_export_forbidden',
    };
  }

  const reportKey = String(args.reportKey || 'overview').trim().toLowerCase();
  if (!TRAINING_REPORT_CATALOGUE.some((r) => r.key === reportKey)) {
    return { ok: false, error: 'unknown_report_key', reportKey };
  }

  if (!hasCustomerTrainingProgramModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_program_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const scopeResult = await resolveTrainingListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    return {
      ok: true,
      reportKey,
      format: String(args.format || 'csv').toLowerCase(),
      rows: [],
      body: toCsv([]),
      reason: scopeResult.reason,
      strippedAnswers: true,
      strippedTokens: true,
      domain: getTrainingDomainContract(),
      meta: { portfolioScoped: true, failClosed: true },
    };
  }

  let rows = [];
  try {
    const where = { ...tenantWhereFromScope(scopeResult.tenantScope) };
    const raw = await prisma.customerTrainingProgram.findMany({ where });
    rows = (raw || [])
      .filter(
        (r) =>
          !scopeResult.tenantScope ||
          scopeResult.tenantScope.includes(String(r.tenantId))
      )
      .map((r) =>
        stripSensitive({
          id: r.id,
          programNumber: r.programNumber,
          status: r.status,
          tenantId: r.tenantId,
          customerId: r.customerId,
          answerPayload: r.answerPayload,
          accessToken: r.accessToken,
          assessmentAnswersJson: r.assessmentAnswersJson,
          restrictedMaterialBody: r.restrictedMaterialBody,
        })
      );
  } catch {
    return {
      ok: false,
      error: 'export_query_failed',
      status: 'UNAVAILABLE',
      rows: null,
      body: null,
    };
  }

  const format = String(args.format || 'csv').toLowerCase();
  const body = format === 'xlsx' || format === 'json' ? JSON.stringify(rows) : toCsv(rows);

  if (
    /SECRET_ANSWER|tok-export|answerPayload|accessToken|assessmentAnswersJson|RESTRICTED/i.test(
      body
    )
  ) {
    return {
      ok: false,
      error: 'export_sanitization_failed',
      body: null,
    };
  }

  return {
    ok: true,
    reportKey,
    format,
    rows,
    body,
    strippedAnswers: true,
    strippedTokens: true,
    domain: getTrainingDomainContract(),
    meta: {
      portfolioScoped: scopeResult.portfolioScoped,
      failClosed: Boolean(scopeResult.portfolioScoped),
    },
  };
}
