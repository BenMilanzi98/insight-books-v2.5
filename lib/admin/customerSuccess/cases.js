/**
 * CS cases — open from signal/health, list/get with portfolio scope.
 * Never mutates source facts. Idempotent open via idempotencyKey.
 */

import { catalogueEntry, CUSTOMER_SIGNAL_RULE_VERSION } from '@/lib/admin/customers/signalCatalogue.js';
import { HEALTH_DEFINITION_VERSION } from '@/lib/admin/health/catalogue.js';
import {
  ALLOWED_SIGNAL_CASE_CODE_SET,
  CS_CASE_PRIORITY,
  CS_CASE_STATUS,
  CS_HEALTH_CASE_BANDS,
  CS_OPEN_CASE_STATUSES,
  CS_TRIGGER_TYPE,
  healthIdempotencyVersion,
  idempotencyKey,
} from './catalogue.js';
import { assertCsTenantAccess, csTenantIdFilter, resolveCsAccess, resolveCsPortfolioScope } from './authz.js';

function hasCsCaseModel(prisma) {
  return typeof prisma?.csCase?.findMany === 'function';
}

function titleForSignal(signalCode) {
  const entry = catalogueEntry(signalCode);
  return entry?.title ? `Case: ${entry.title}` : `Case: ${signalCode}`;
}

function priorityForSignal(signalCode) {
  const entry = catalogueEntry(signalCode);
  const sev = String(entry?.severity || '').toUpperCase();
  if (sev === 'CRITICAL') return CS_CASE_PRIORITY.CRITICAL;
  if (sev === 'HIGH') return CS_CASE_PRIORITY.HIGH;
  if (sev === 'LOW') return CS_CASE_PRIORITY.LOW;
  return CS_CASE_PRIORITY.MEDIUM;
}

function serializeCase(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    portfolioId: row.portfolioId || null,
    status: row.status,
    priority: row.priority || CS_CASE_PRIORITY.MEDIUM,
    severity: row.severity || null,
    title: row.title,
    summary: row.summary || null,
    triggerType: row.triggerType,
    triggerCode: row.triggerCode || null,
    definitionVersion: row.definitionVersion || null,
    idempotencyKey: row.idempotencyKey,
    signalId: row.signalId || null,
    snapshotId: row.snapshotId || null,
    ownerAdminId: row.ownerAdminId || null,
    openedByAdminId: row.openedByAdminId || null,
    openedAt: row.openedAt ? new Date(row.openedAt).toISOString() : null,
    closedAt: row.closedAt ? new Date(row.closedAt).toISOString() : null,
    resolvedAt: row.resolvedAt ? new Date(row.resolvedAt).toISOString() : null,
    payload: row.payload || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

function isPrismaUniqueViolation(err) {
  return Boolean(err && typeof err === 'object' && err.code === 'P2002');
}

async function findOpenByKey(prisma, key) {
  if (!hasCsCaseModel(prisma) || !key) return null;
  try {
    return await prisma.csCase.findFirst({
      where: {
        idempotencyKey: key,
        status: { in: [...CS_OPEN_CASE_STATUSES] },
      },
    });
  } catch {
    return null;
  }
}

/** Soft open check + create; P2002 races re-fetch open case as idempotent no-op. */
async function createOpenCaseIdempotent(prisma, key, data) {
  const existing = await findOpenByKey(prisma, key);
  if (existing) {
    return {
      ok: true,
      created: false,
      noop: true,
      idempotent: true,
      case: serializeCase(existing),
    };
  }

  try {
    const row = await prisma.csCase.create({ data });
    return { ok: true, created: true, case: serializeCase(row) };
  } catch (err) {
    if (!isPrismaUniqueViolation(err)) throw err;
    const raced = await findOpenByKey(prisma, key);
    if (raced) {
      return {
        ok: true,
        created: false,
        noop: true,
        idempotent: true,
        case: serializeCase(raced),
      };
    }
    throw err;
  }
}

/**
 * Open a case from an allowed Phase 7 signal. No-op if open case with same key.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   tenantId: string,
 *   signalCode: string,
 *   signalId?: string|null,
 *   portfolioId?: string|null,
 *   now?: Date,
 * }} args
 */
export async function openCaseFromSignal(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true, reason: 'cs_forbidden' };
  }
  if (!access.canManageCases) {
    return { ok: false, forbidden: true, reason: 'manage_cases_required' };
  }

  const tenantId = args.tenantId ? String(args.tenantId) : '';
  const signalCode = args.signalCode ? String(args.signalCode).trim() : '';
  if (!tenantId || !signalCode) {
    return { ok: false, error: 'tenantId and signalCode required' };
  }

  if (!ALLOWED_SIGNAL_CASE_CODE_SET.has(signalCode)) {
    return {
      ok: false,
      error: 'signal_code_not_allowed_for_case',
      reason: 'signal_code_not_allowed_for_case',
      signalCode,
    };
  }

  const gate = await assertCsTenantAccess(prisma, args.admin, tenantId, {
    now: args.now,
  });
  if (!gate.ok) {
    return { ok: false, forbidden: true, reason: gate.reason || 'out_of_portfolio_scope' };
  }

  if (!hasCsCaseModel(prisma)) {
    return { ok: false, error: 'cs_case_model_unavailable', status: 'UNAVAILABLE' };
  }

  const key = idempotencyKey({
    tenantId,
    triggerType: CS_TRIGGER_TYPE.SIGNAL,
    triggerCode: signalCode,
    definitionVersion: CUSTOMER_SIGNAL_RULE_VERSION,
  });

  const entry = catalogueEntry(signalCode) || {};
  return createOpenCaseIdempotent(prisma, key, {
    tenantId,
    portfolioId: args.portfolioId || null,
    status: CS_CASE_STATUS.OPEN,
    priority: priorityForSignal(signalCode),
    severity: entry.severity || null,
    title: titleForSignal(signalCode),
    summary: `Auto-opened from signal ${signalCode}`,
    triggerType: CS_TRIGGER_TYPE.SIGNAL,
    triggerCode: signalCode,
    definitionVersion: CUSTOMER_SIGNAL_RULE_VERSION,
    idempotencyKey: key,
    signalId: args.signalId || null,
    openedByAdminId: args.admin?.id || null,
    ownerAdminId: args.admin?.id || null,
    payload: {
      source: 'signal',
      signalCode,
      signalId: args.signalId || null,
    },
  });
}

/**
 * Open a case from health snapshot band. Only AT_RISK / CRITICAL.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   tenantId: string,
 *   band: string,
 *   snapshotId: string,
 *   definitionVersion?: string,
 *   portfolioId?: string|null,
 *   now?: Date,
 * }} args
 */
export async function openCaseFromHealth(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true, reason: 'cs_forbidden' };
  }
  if (!access.canManageCases) {
    return { ok: false, forbidden: true, reason: 'manage_cases_required' };
  }

  const tenantId = args.tenantId ? String(args.tenantId) : '';
  const band = args.band ? String(args.band).trim().toUpperCase() : '';
  const snapshotId = args.snapshotId ? String(args.snapshotId) : '';
  if (!tenantId || !band) {
    return { ok: false, error: 'tenantId and band required' };
  }

  if (!CS_HEALTH_CASE_BANDS.includes(band)) {
    return {
      ok: false,
      error: 'health_band_not_eligible',
      reason: 'Only AT_RISK or CRITICAL bands may open a health case',
    };
  }

  const gate = await assertCsTenantAccess(prisma, args.admin, tenantId, {
    now: args.now,
  });
  if (!gate.ok) {
    return { ok: false, forbidden: true, reason: gate.reason || 'out_of_portfolio_scope' };
  }

  if (!hasCsCaseModel(prisma)) {
    return { ok: false, error: 'cs_case_model_unavailable', status: 'UNAVAILABLE' };
  }

  let definitionVersion = args.definitionVersion || HEALTH_DEFINITION_VERSION;
  if (snapshotId && typeof prisma.customerHealthSnapshot?.findUnique === 'function') {
    try {
      const snap = await prisma.customerHealthSnapshot.findUnique({
        where: { id: snapshotId },
      });
      if (snap?.definitionVersion) definitionVersion = snap.definitionVersion;
      if (snap?.tenantId && snap.tenantId !== tenantId) {
        return { ok: false, error: 'snapshot_tenant_mismatch' };
      }
    } catch {
      // ignore missing model
    }
  }

  const now = args.now || new Date();
  const key = idempotencyKey({
    tenantId,
    triggerType: CS_TRIGGER_TYPE.HEALTH,
    triggerCode: band,
    definitionVersion: healthIdempotencyVersion(definitionVersion, now),
  });

  return createOpenCaseIdempotent(prisma, key, {
    tenantId,
    portfolioId: args.portfolioId || null,
    status: CS_CASE_STATUS.OPEN,
    priority:
      band === 'CRITICAL' ? CS_CASE_PRIORITY.CRITICAL : CS_CASE_PRIORITY.HIGH,
    severity: band,
    title: `Health case: ${band}`,
    summary: `Auto-opened from health band ${band}`,
    triggerType: CS_TRIGGER_TYPE.HEALTH,
    triggerCode: band,
    definitionVersion,
    idempotencyKey: key,
    snapshotId: snapshotId || null,
    openedByAdminId: args.admin?.id || null,
    ownerAdminId: args.admin?.id || null,
    payload: {
      source: 'health',
      band,
      snapshotId: snapshotId || null,
      definitionVersion,
    },
  });
}

/**
 * Manual case create (optional idempotencyKey).
 */
export async function createManualCase(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canManageCases) {
    return { ok: false, forbidden: true, reason: 'manage_cases_required' };
  }

  const tenantId = args.tenantId ? String(args.tenantId) : '';
  const title = args.title ? String(args.title).trim() : '';
  if (!tenantId || !title) {
    return { ok: false, error: 'tenantId and title required' };
  }

  const gate = await assertCsTenantAccess(prisma, args.admin, tenantId, {
    now: args.now,
  });
  if (!gate.ok) {
    return { ok: false, forbidden: true, reason: gate.reason || 'out_of_portfolio_scope' };
  }

  if (!hasCsCaseModel(prisma)) {
    return { ok: false, error: 'cs_case_model_unavailable', status: 'UNAVAILABLE' };
  }

  let key = args.idempotencyKey ? String(args.idempotencyKey) : null;
  if (!key) {
    key = idempotencyKey({
      tenantId,
      triggerType: CS_TRIGGER_TYPE.MANUAL,
      triggerCode: args.triggerCode || `MANUAL-${Date.now()}`,
      definitionVersion: args.definitionVersion || 'manual',
    });
  }

  return createOpenCaseIdempotent(prisma, key, {
    tenantId,
    portfolioId: args.portfolioId || null,
    status: CS_CASE_STATUS.OPEN,
    priority: args.priority || CS_CASE_PRIORITY.MEDIUM,
    severity: args.severity || null,
    title,
    summary: args.summary || null,
    triggerType: CS_TRIGGER_TYPE.MANUAL,
    triggerCode: args.triggerCode || 'MANUAL',
    definitionVersion: args.definitionVersion || 'manual',
    idempotencyKey: key,
    openedByAdminId: args.admin?.id || null,
    ownerAdminId: args.ownerAdminId || args.admin?.id || null,
    payload: args.payload || { source: 'manual' },
  });
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, caseId: string, now?: Date }} args
 */
export async function getCase(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true, reason: 'cs_forbidden' };
  }

  const caseId = args.caseId ? String(args.caseId) : '';
  if (!caseId) return { ok: false, error: 'caseId required' };

  if (!hasCsCaseModel(prisma)) {
    return { ok: false, error: 'cs_case_model_unavailable', status: 'UNAVAILABLE' };
  }

  let row = null;
  try {
    row = await prisma.csCase.findUnique({ where: { id: caseId } });
    if (!row && typeof prisma.csCase.findFirst === 'function') {
      row = await prisma.csCase.findFirst({ where: { id: caseId } });
    }
  } catch {
    row = null;
  }

  if (!row) return { ok: false, notFound: true, error: 'case_not_found' };

  const gate = await assertCsTenantAccess(prisma, args.admin, row.tenantId, {
    now: args.now,
  });
  if (!gate.ok) {
    return { ok: false, forbidden: true, reason: gate.reason || 'out_of_portfolio_scope' };
  }

  return { ok: true, case: serializeCase(row) };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   status?: string|string[],
 *   tenantId?: string,
 *   limit?: number,
 *   now?: Date,
 * }} args
 */
export async function listCases(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true, reason: 'cs_forbidden', items: [] };
  }

  if (!hasCsCaseModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'cs_case_model_unavailable' },
    };
  }

  const scope = await resolveCsPortfolioScope(prisma, args.admin, { now: args.now });
  const tenantFilter = csTenantIdFilter(scope);
  const where = {};

  if (args.tenantId) {
    const tid = String(args.tenantId);
    const gate = await assertCsTenantAccess(prisma, args.admin, tid, {
      now: args.now,
    });
    if (!gate.ok) {
      return { ok: false, forbidden: true, reason: gate.reason, items: [] };
    }
    where.tenantId = tid;
  } else if (tenantFilter) {
    where.tenantId = tenantFilter;
  }

  if (args.status) {
    where.status = Array.isArray(args.status)
      ? { in: args.status }
      : String(args.status);
  }

  const limit = Math.min(200, Math.max(1, Number(args.limit) || 50));
  let rows = [];
  try {
    rows = await prisma.csCase.findMany({
      where,
      orderBy: { openedAt: 'desc' },
      take: limit,
    });
  } catch {
    rows = await prisma.csCase.findMany({ where });
  }

  return {
    ok: true,
    items: (rows || []).map(serializeCase),
    meta: {
      count: (rows || []).length,
      scopeMode: scope.mode,
      limit,
    },
  };
}

/**
 * Update case status / assignment (portfolio-scoped). Does not touch source facts.
 */
export async function updateCase(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canManageCases) {
    return { ok: false, forbidden: true, reason: 'manage_cases_required' };
  }

  const existing = await getCase(prisma, {
    admin: args.admin,
    caseId: args.caseId,
    now: args.now,
  });
  if (!existing.ok) return existing;

  if (typeof prisma.csCase?.update !== 'function') {
    return { ok: false, error: 'cs_case_model_unavailable', status: 'UNAVAILABLE' };
  }

  const data = {};
  if (args.status) data.status = String(args.status);
  if (args.priority) data.priority = String(args.priority);
  if (args.ownerAdminId !== undefined) data.ownerAdminId = args.ownerAdminId || null;
  if (args.summary !== undefined) data.summary = args.summary;
  if (args.status === CS_CASE_STATUS.RESOLVED) data.resolvedAt = new Date();
  if (args.status === CS_CASE_STATUS.CLOSED) data.closedAt = new Date();

  const row = await prisma.csCase.update({
    where: { id: args.caseId },
    data,
  });

  return { ok: true, case: serializeCase(row) };
}

export { serializeCase, hasCsCaseModel };
