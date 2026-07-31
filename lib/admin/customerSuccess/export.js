/**
 * CS export foundation — portfolio-scoped JSON|CSV of cases / tasks / plans / handoffs.
 * Never Tenant Sale. Never invents onboarding/training progress.
 */

import { CS_CASE_DEFINITION_VERSION } from './catalogue.js';
import { resolveCsAccess } from './authz.js';
import { listCases } from './cases.js';
import { listTasks } from './tasks.js';
import { listSuccessPlans } from './plans.js';
import { listExpansionHandoffs } from './handoffs.js';

function csvEscape(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   dataset?: 'cases'|'tasks'|'plans'|'handoffs',
 *   format?: 'json'|'csv',
 *   tenantId?: string,
 *   now?: Date,
 * }} opts
 */
export async function buildCsExportPack(prisma, opts = {}) {
  const access = resolveCsAccess(opts.admin);
  if (!access.canView) {
    return {
      ok: false,
      forbidden: true,
      definitionVersion: CS_CASE_DEFINITION_VERSION,
    };
  }

  const dataset = String(opts.dataset || 'cases').toLowerCase();
  const now = opts.now || new Date();
  const common = {
    admin: opts.admin,
    tenantId: opts.tenantId,
    now,
    limit: 200,
  };

  let result;
  if (dataset === 'tasks') {
    result = await listTasks(prisma, common);
  } else if (dataset === 'plans') {
    result = await listSuccessPlans(prisma, common);
  } else if (dataset === 'handoffs') {
    result = await listExpansionHandoffs(prisma, common);
  } else if (dataset === 'cases') {
    result = await listCases(prisma, common);
  } else {
    return { ok: false, error: 'dataset must be cases|tasks|plans|handoffs' };
  }

  if (result.forbidden) {
    return {
      ok: false,
      forbidden: true,
      definitionVersion: CS_CASE_DEFINITION_VERSION,
    };
  }

  return {
    ok: true,
    dataset,
    definitionVersion: CS_CASE_DEFINITION_VERSION,
    exportedAt: now.toISOString(),
    rows: result.items || [],
    meta: result.meta || {},
    limitations: [
      'CS export foundation — capped list within portfolio scope.',
      'Never includes Tenant Sale or tenant GL revenue.',
      'Onboarding/training/survey progress is never invented or exported as %.',
      'Expansion handoffs are record-only (no CRM opportunities).',
    ],
  };
}

/**
 * @param {object} pack — from buildCsExportPack
 * @returns {string}
 */
export function formatCsExportCsv(pack) {
  const rows = pack?.rows || [];
  if (!rows.length) {
    return 'id,tenantId,title,status\n';
  }

  const keys = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== 'object');
  const header = keys.join(',');
  const lines = [header];
  for (const row of rows) {
    lines.push(keys.map((k) => csvEscape(row[k])).join(','));
  }
  return `${lines.join('\n')}\n`;
}
