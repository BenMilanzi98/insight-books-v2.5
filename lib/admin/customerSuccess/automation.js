/**
 * CS automation — deterministic, idempotent case opening from signals/health.
 * Never invents support tickets or mutates source facts.
 */

import { ALLOWED_SIGNAL_CASE_CODES, CS_HEALTH_CASE_BANDS } from './catalogue.js';
import { openCaseFromHealth, openCaseFromSignal } from './cases.js';
import { resolveCsAccess } from './authz.js';

/**
 * Run allowed signal→case automation for one tenant (idempotent per key).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   tenantId: string,
 *   signals?: Array<{ code: string, id?: string }>,
 *   now?: Date,
 * }} args
 */
export async function runSignalCaseAutomation(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canManageCases) {
    return { ok: false, forbidden: true, reason: 'manage_cases_required', results: [] };
  }

  const tenantId = args.tenantId ? String(args.tenantId) : '';
  if (!tenantId) {
    return { ok: false, error: 'tenantId required', results: [] };
  }

  const signals = Array.isArray(args.signals) ? args.signals : [];
  const allowed = signals.filter((s) =>
    ALLOWED_SIGNAL_CASE_CODES.includes(String(s?.code || ''))
  );

  const results = [];
  for (const signal of allowed) {
    const result = await openCaseFromSignal(prisma, {
      admin: args.admin,
      tenantId,
      signalCode: signal.code,
      signalId: signal.id || null,
      now: args.now,
    });
    results.push({
      signalCode: signal.code,
      signalId: signal.id || null,
      ...result,
    });
  }

  return {
    ok: true,
    tenantId,
    results,
    meta: {
      attempted: allowed.length,
      created: results.filter((r) => r.created).length,
      noop: results.filter((r) => r.noop || r.idempotent).length,
    },
  };
}

/**
 * Open health case when band is AT_RISK/CRITICAL (idempotent per day+band).
 */
export async function runHealthCaseAutomation(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canManageCases) {
    return { ok: false, forbidden: true, reason: 'manage_cases_required' };
  }

  const band = args.band ? String(args.band).toUpperCase() : '';
  if (!CS_HEALTH_CASE_BANDS.includes(band)) {
    return {
      ok: false,
      skipped: true,
      reason: 'band_not_eligible',
      band,
    };
  }

  return openCaseFromHealth(prisma, {
    admin: args.admin,
    tenantId: args.tenantId,
    band,
    snapshotId: args.snapshotId,
    definitionVersion: args.definitionVersion,
    now: args.now,
  });
}

/**
 * Unified automation entry — deterministic dispatch.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   kind: 'signal'|'health'|'signals',
 *   tenantId: string,
 *   signalCode?: string,
 *   signalId?: string,
 *   signals?: Array<{ code: string, id?: string }>,
 *   band?: string,
 *   snapshotId?: string,
 *   definitionVersion?: string,
 *   now?: Date,
 * }} args
 */
export async function runCsAutomation(prisma, args = {}) {
  const kind = String(args.kind || '').toLowerCase();

  if (kind === 'signal') {
    return openCaseFromSignal(prisma, {
      admin: args.admin,
      tenantId: args.tenantId,
      signalCode: args.signalCode,
      signalId: args.signalId,
      now: args.now,
    });
  }

  if (kind === 'signals') {
    return runSignalCaseAutomation(prisma, args);
  }

  if (kind === 'health') {
    return runHealthCaseAutomation(prisma, args);
  }

  return { ok: false, error: 'unknown_automation_kind', kind };
}
