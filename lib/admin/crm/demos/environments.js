/**
 * Logical Demo Environments — Phase 14 Wave 3.
 * DENV numbering; request/approve; logical provisioner; health; reset; expiry; deprovision.
 * READY only via approved provision path + health — never invent READY.
 * No Production connections; ≠ MRA EIS sandbox; cloud infra NOT_AVAILABLE.
 */

import {
  CRM_DEMO_ENVIRONMENT_HEALTH,
  CRM_DEMO_ENVIRONMENT_STATUS,
  CRM_DEMO_VERSION_STATUS,
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
  CRM_SUBJECT_TYPE,
  CRM_TIMELINE_EVENT_TYPE,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { appendTimelineEvent } from '../timeline.js';
import { hasCrmDemoModel, serializeDemo } from './model.js';
import { allocateDemoEnvironmentNumber } from './numbering.js';
import { hasCrmDemoDataPackModel, serializeDataPack } from './dataPacks.js';
import {
  assertSodApprover,
  canApproveDemoContent,
  canEditDemoContent,
  canViewDemoContent,
  resolveDemoContentAccess,
} from './versioning.js';

const CONNECTION_GUARDS = Object.freeze({
  productionDb: false,
  productionPayment: false,
  mraEisEndpoint: false,
  productionEmailSender: false,
  cloudContainer: false,
  productionTenantAlias: false,
});

export function hasCrmDemoEnvironmentModel(prisma) {
  return typeof prisma?.crmDemoEnvironment?.create === 'function';
}

export function serializeEnvironment(row) {
  if (!row) return null;
  return {
    id: row.id,
    envNumber: row.envNumber,
    demoId: row.demoId,
    status: row.status,
    healthStatus: row.healthStatus || CRM_DEMO_ENVIRONMENT_HEALTH.UNKNOWN,
    healthJson: row.healthJson ?? null,
    dataPackId: row.dataPackId || null,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
    demoBannerVisible: row.demoBannerVisible !== false,
    cloudProvisionStatus: row.cloudProvisionStatus || 'NOT_AVAILABLE',
    mraEisSandboxAliased: row.mraEisSandboxAliased === true,
    productionConnections: row.productionConnections === true,
    connectionGuardsJson: row.connectionGuardsJson ?? CONNECTION_GUARDS,
    logicalProvisionToken: row.logicalProvisionToken || null,
    provisionedAt: row.provisionedAt
      ? new Date(row.provisionedAt).toISOString()
      : null,
    lastHealthAt: row.lastHealthAt ? new Date(row.lastHealthAt).toISOString() : null,
    deprovisionedAt: row.deprovisionedAt
      ? new Date(row.deprovisionedAt).toISOString()
      : null,
    requestedByAdminId: row.requestedByAdminId || null,
    approvedByAdminId: row.approvedByAdminId || null,
    approvedAt: row.approvedAt ? new Date(row.approvedAt).toISOString() : null,
    requestIdempotencyKey: row.requestIdempotencyKey || null,
    provisionIdempotencyKey: row.provisionIdempotencyKey || null,
    resetIdempotencyKey: row.resetIdempotencyKey || null,
    deprovisionIdempotencyKey: row.deprovisionIdempotencyKey || null,
    notes: row.notes || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

async function loadDemo(prisma, demoId) {
  const id = demoId ? String(demoId).trim() : '';
  if (!id || !hasCrmDemoModel(prisma)) return null;
  try {
    if (/^DEMO-\d{4}-\d{6}$/.test(id)) {
      return await prisma.crmDemo.findUnique({ where: { demoNumber: id } });
    }
    return await prisma.crmDemo.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

async function loadEnv(prisma, envId) {
  const id = envId ? String(envId).trim() : '';
  if (!id || !hasCrmDemoEnvironmentModel(prisma)) return null;
  try {
    if (/^DENV-\d{4}-\d{6}$/.test(id)) {
      return await prisma.crmDemoEnvironment.findUnique({ where: { envNumber: id } });
    }
    return await prisma.crmDemoEnvironment.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

function parseExpiry(raw) {
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Logical health check — never fabricates cloud readiness.
 * READY requires: not expired, banner on, no production connections, not MRA alias, logical token present.
 */
export function evaluateLogicalEnvironmentHealth(env, now = new Date()) {
  const expiresAt = env.expiresAt ? new Date(env.expiresAt) : null;
  const expired = !expiresAt || Number.isNaN(expiresAt.getTime()) || now.getTime() >= expiresAt.getTime();
  const checks = {
    expiryPresent: Boolean(expiresAt) && !Number.isNaN(expiresAt.getTime()),
    notExpired: !expired,
    demoBannerVisible: env.demoBannerVisible !== false,
    noProductionConnections: env.productionConnections !== true,
    mraEisNotAliased: env.mraEisSandboxAliased !== true,
    cloudNotFabricated: (env.cloudProvisionStatus || 'NOT_AVAILABLE') === 'NOT_AVAILABLE',
    logicalTokenPresent: Boolean(env.logicalProvisionToken),
    connectionGuardsOk: true,
  };
  const guards = env.connectionGuardsJson || CONNECTION_GUARDS;
  for (const k of Object.keys(CONNECTION_GUARDS)) {
    if (guards[k] === true) {
      checks.connectionGuardsOk = false;
      checks[`guard_${k}`] = false;
    }
  }

  if (expired) {
    return {
      healthStatus: CRM_DEMO_ENVIRONMENT_HEALTH.EXPIRED,
      ok: false,
      checks,
      detail: 'Environment expired — READY blocked',
    };
  }

  const required = [
    'expiryPresent',
    'notExpired',
    'demoBannerVisible',
    'noProductionConnections',
    'mraEisNotAliased',
    'cloudNotFabricated',
    'logicalTokenPresent',
    'connectionGuardsOk',
  ];
  const failed = required.filter((k) => !checks[k]);
  if (failed.length > 0) {
    return {
      healthStatus: CRM_DEMO_ENVIRONMENT_HEALTH.UNHEALTHY,
      ok: false,
      checks,
      failed,
      detail: `Health failed: ${failed.join(', ')}`,
    };
  }
  return {
    healthStatus: CRM_DEMO_ENVIRONMENT_HEALTH.HEALTHY,
    ok: true,
    checks,
    detail: 'Logical Demo Environment healthy (≠ MRA EIS sandbox)',
  };
}

/**
 * Request a logical Demo Environment. Expiry required.
 */
export async function requestDemoEnvironment(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_environment_forbidden' };
  }
  if (!hasCrmDemoEnvironmentModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_environment_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  const expiresAt = parseExpiry(args.expiresAt);
  if (!expiresAt) {
    return { ok: false, error: 'environment_expiry_required' };
  }
  const now = args.now || new Date();
  if (expiresAt.getTime() <= now.getTime()) {
    return { ok: false, error: 'environment_expiry_must_be_future' };
  }

  const requestIdempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  if (requestIdempotencyKey) {
    try {
      const existing = await prisma.crmDemoEnvironment.findUnique({
        where: { requestIdempotencyKey },
      });
      if (existing) {
        return {
          ok: true,
          environment: serializeEnvironment(existing),
          alreadyExists: true,
        };
      }
    } catch {
      // continue
    }
  }

  let dataPackId = args.dataPackId ? String(args.dataPackId).trim() : null;
  if (dataPackId) {
    if (!hasCrmDemoDataPackModel(prisma)) {
      return { ok: false, error: 'crm_demo_data_pack_model_unavailable', status: 'UNAVAILABLE' };
    }
    const pack = await prisma.crmDemoDataPack.findUnique({ where: { id: dataPackId } });
    if (!pack) return { ok: false, error: 'data_pack_not_found' };
    if (pack.status !== CRM_DEMO_VERSION_STATUS.ACTIVE) {
      return { ok: false, error: 'data_pack_not_active' };
    }
  }

  if (args.aliasMraEisSandbox === true || args.useProductionTenant === true) {
    return {
      ok: false,
      error: 'mra_eis_or_production_tenant_alias_forbidden',
      reason: 'demo_environment_ne_mra_eis_ne_production',
    };
  }

  const allocated = await allocateDemoEnvironmentNumber(prisma, { now });
  if (!allocated.ok) {
    return { ok: false, error: allocated.error || 'denv_number_allocation_failed' };
  }

  try {
    const row = await prisma.crmDemoEnvironment.create({
      data: {
        envNumber: allocated.number,
        demoId: demo.id,
        status: CRM_DEMO_ENVIRONMENT_STATUS.REQUESTED,
        healthStatus: CRM_DEMO_ENVIRONMENT_HEALTH.UNKNOWN,
        dataPackId,
        expiresAt,
        demoBannerVisible: true,
        cloudProvisionStatus: 'NOT_AVAILABLE',
        mraEisSandboxAliased: false,
        productionConnections: false,
        connectionGuardsJson: { ...CONNECTION_GUARDS },
        requestedByAdminId: args.admin?.id || null,
        requestIdempotencyKey,
        notes: args.notes != null ? String(args.notes).trim().slice(0, 2000) : null,
        createdAt: now,
        updatedAt: now,
      },
    });

    await prisma.crmDemo.update({
      where: { id: demo.id },
      data: { environmentId: row.id, updatedAt: now },
    });

    await appendTimelineEvent(prisma, {
      subjectType: CRM_SUBJECT_TYPE.DEMO,
      subjectId: demo.id,
      eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_ENVIRONMENT_REQUESTED,
      summary: `Demo environment requested ${row.envNumber}`,
      payload: { envId: row.id, envNumber: row.envNumber, expiresAt: expiresAt.toISOString() },
      actorAdminId: args.admin?.id || null,
      at: now,
    });

    return { ok: true, environment: serializeEnvironment(row), demo: serializeDemo({ ...demo, environmentId: row.id }) };
  } catch (err) {
    if (requestIdempotencyKey && err?.code === 'P2002') {
      const raced = await prisma.crmDemoEnvironment.findUnique({
        where: { requestIdempotencyKey },
      });
      if (raced) {
        return { ok: true, environment: serializeEnvironment(raced), alreadyExists: true };
      }
    }
    return { ok: false, error: err?.message || 'environment_request_failed' };
  }
}

export async function approveDemoEnvironment(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canApproveDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_environment_approve_forbidden' };
  }
  const row = await loadEnv(prisma, args.environmentId || args.envId || args.id);
  if (!row) return { ok: false, notFound: true, error: 'environment_not_found' };
  if (row.status !== CRM_DEMO_ENVIRONMENT_STATUS.REQUESTED) {
    return { ok: false, error: 'environment_not_requestable_for_approval' };
  }
  const sod = assertSodApprover(
    { authoredByAdminId: row.requestedByAdminId },
    args.admin
  );
  if (!sod.ok) {
    return {
      ok: false,
      error: 'demo_environment_self_approval_blocked',
      reason: sod.reason || 'sod_author_must_differ_from_approver',
    };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmDemoEnvironment.update({
    where: { id: row.id },
    data: {
      status: CRM_DEMO_ENVIRONMENT_STATUS.APPROVED,
      approvedByAdminId: sod.approverId,
      approvedAt: now,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: row.demoId,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_ENVIRONMENT_APPROVED,
    summary: `Demo environment approved ${row.envNumber}`,
    payload: { envId: row.id, envNumber: row.envNumber },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return { ok: true, environment: serializeEnvironment(updated) };
}

/**
 * Logical provisioner — sets READY only after health check passes.
 * Idempotent via provisionIdempotencyKey.
 */
export async function provisionDemoEnvironment(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_environment_forbidden' };
  }
  const row = await loadEnv(prisma, args.environmentId || args.envId || args.id);
  if (!row) return { ok: false, notFound: true, error: 'environment_not_found' };

  const provisionIdempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;

  if (
    provisionIdempotencyKey &&
    row.provisionIdempotencyKey === provisionIdempotencyKey &&
    row.status === CRM_DEMO_ENVIRONMENT_STATUS.READY
  ) {
    return {
      ok: true,
      environment: serializeEnvironment(row),
      alreadyProvisioned: true,
    };
  }

  if (
    row.status !== CRM_DEMO_ENVIRONMENT_STATUS.APPROVED &&
    row.status !== CRM_DEMO_ENVIRONMENT_STATUS.UNHEALTHY &&
    !(
      row.status === CRM_DEMO_ENVIRONMENT_STATUS.READY &&
      provisionIdempotencyKey &&
      row.provisionIdempotencyKey === provisionIdempotencyKey
    )
  ) {
    if (row.status === CRM_DEMO_ENVIRONMENT_STATUS.READY) {
      return {
        ok: true,
        environment: serializeEnvironment(row),
        alreadyProvisioned: true,
      };
    }
    return { ok: false, error: 'environment_not_approved_for_provision' };
  }

  if (args.cloudProvider || args.fabricateCloud === true) {
    return {
      ok: false,
      error: 'cloud_demo_infra_not_available',
      cloudProvisionStatus: 'NOT_AVAILABLE',
    };
  }

  const now = args.now || new Date();
  const token = `logical:${row.envNumber}:${now.getTime()}`;

  // Move to PROVISIONING first — never jump to READY without health
  await prisma.crmDemoEnvironment.update({
    where: { id: row.id },
    data: {
      status: CRM_DEMO_ENVIRONMENT_STATUS.PROVISIONING,
      logicalProvisionToken: token,
      provisionedAt: now,
      provisionIdempotencyKey: provisionIdempotencyKey || row.provisionIdempotencyKey,
      demoBannerVisible: true,
      cloudProvisionStatus: 'NOT_AVAILABLE',
      mraEisSandboxAliased: false,
      productionConnections: false,
      connectionGuardsJson: { ...CONNECTION_GUARDS },
      updatedAt: now,
    },
  });

  const mid = await loadEnv(prisma, row.id);
  const health = evaluateLogicalEnvironmentHealth(mid, now);

  const finalStatus = health.ok
    ? CRM_DEMO_ENVIRONMENT_STATUS.READY
    : health.healthStatus === CRM_DEMO_ENVIRONMENT_HEALTH.EXPIRED
      ? CRM_DEMO_ENVIRONMENT_STATUS.EXPIRED
      : CRM_DEMO_ENVIRONMENT_STATUS.UNHEALTHY;

  const updated = await prisma.crmDemoEnvironment.update({
    where: { id: row.id },
    data: {
      status: finalStatus,
      healthStatus: health.healthStatus,
      healthJson: {
        ...health,
        evaluatedAt: now.toISOString(),
        provisionPath: 'logical',
        inventReadyForbidden: true,
      },
      lastHealthAt: now,
      updatedAt: now,
    },
  });

  if (finalStatus === CRM_DEMO_ENVIRONMENT_STATUS.READY) {
    await appendTimelineEvent(prisma, {
      subjectType: CRM_SUBJECT_TYPE.DEMO,
      subjectId: row.demoId,
      eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_ENVIRONMENT_PROVISIONED,
      summary: `Demo environment provisioned ${row.envNumber}`,
      payload: {
        envId: row.id,
        envNumber: row.envNumber,
        healthStatus: health.healthStatus,
        logical: true,
      },
      actorAdminId: args.admin?.id || null,
      at: now,
    });
  }

  return {
    ok: health.ok,
    environment: serializeEnvironment(updated),
    health,
    error: health.ok ? undefined : 'environment_health_failed',
  };
}

export async function runDemoEnvironmentHealthCheck(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canViewDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_environment_forbidden' };
  }
  const row = await loadEnv(prisma, args.environmentId || args.envId || args.id);
  if (!row) return { ok: false, notFound: true, error: 'environment_not_found' };

  const now = args.now || new Date();
  const health = evaluateLogicalEnvironmentHealth(row, now);

  let nextStatus = row.status;
  if (row.status === CRM_DEMO_ENVIRONMENT_STATUS.DEPROVISIONED) {
    // keep
  } else if (health.healthStatus === CRM_DEMO_ENVIRONMENT_HEALTH.EXPIRED) {
    nextStatus = CRM_DEMO_ENVIRONMENT_STATUS.EXPIRED;
  } else if (
    row.status === CRM_DEMO_ENVIRONMENT_STATUS.READY ||
    row.status === CRM_DEMO_ENVIRONMENT_STATUS.UNHEALTHY
  ) {
    nextStatus = health.ok
      ? CRM_DEMO_ENVIRONMENT_STATUS.READY
      : CRM_DEMO_ENVIRONMENT_STATUS.UNHEALTHY;
  }

  const updated = await prisma.crmDemoEnvironment.update({
    where: { id: row.id },
    data: {
      status: nextStatus,
      healthStatus: health.healthStatus,
      healthJson: { ...health, evaluatedAt: now.toISOString() },
      lastHealthAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    environment: serializeEnvironment(updated),
    health,
    healthy: health.ok,
  };
}

/**
 * Reset logical environment — idempotent via resetIdempotencyKey.
 * Re-runs health after reset; READY only if health passes.
 */
export async function resetDemoEnvironment(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_environment_forbidden' };
  }
  const row = await loadEnv(prisma, args.environmentId || args.envId || args.id);
  if (!row) return { ok: false, notFound: true, error: 'environment_not_found' };

  const resetIdempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  if (
    resetIdempotencyKey &&
    row.resetIdempotencyKey === resetIdempotencyKey &&
    row.status === CRM_DEMO_ENVIRONMENT_STATUS.READY
  ) {
    return {
      ok: true,
      environment: serializeEnvironment(row),
      alreadyReset: true,
    };
  }

  if (
    row.status !== CRM_DEMO_ENVIRONMENT_STATUS.READY &&
    row.status !== CRM_DEMO_ENVIRONMENT_STATUS.UNHEALTHY
  ) {
    return { ok: false, error: 'environment_not_resettable' };
  }

  const now = args.now || new Date();
  const token = `logical-reset:${row.envNumber}:${now.getTime()}`;

  await prisma.crmDemoEnvironment.update({
    where: { id: row.id },
    data: {
      status: CRM_DEMO_ENVIRONMENT_STATUS.PROVISIONING,
      logicalProvisionToken: token,
      resetIdempotencyKey: resetIdempotencyKey || row.resetIdempotencyKey,
      demoBannerVisible: true,
      productionConnections: false,
      mraEisSandboxAliased: false,
      cloudProvisionStatus: 'NOT_AVAILABLE',
      connectionGuardsJson: { ...CONNECTION_GUARDS },
      updatedAt: now,
    },
  });

  const mid = await loadEnv(prisma, row.id);
  const health = evaluateLogicalEnvironmentHealth(mid, now);
  const finalStatus = health.ok
    ? CRM_DEMO_ENVIRONMENT_STATUS.READY
    : health.healthStatus === CRM_DEMO_ENVIRONMENT_HEALTH.EXPIRED
      ? CRM_DEMO_ENVIRONMENT_STATUS.EXPIRED
      : CRM_DEMO_ENVIRONMENT_STATUS.UNHEALTHY;

  const updated = await prisma.crmDemoEnvironment.update({
    where: { id: row.id },
    data: {
      status: finalStatus,
      healthStatus: health.healthStatus,
      healthJson: { ...health, evaluatedAt: now.toISOString(), reset: true },
      lastHealthAt: now,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: row.demoId,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_ENVIRONMENT_RESET,
    summary: `Demo environment reset ${row.envNumber}`,
    payload: { envId: row.id, healthStatus: health.healthStatus },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return {
    ok: health.ok,
    environment: serializeEnvironment(updated),
    health,
    error: health.ok ? undefined : 'environment_health_failed_after_reset',
  };
}

export async function deprovisionDemoEnvironment(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_environment_forbidden' };
  }
  const row = await loadEnv(prisma, args.environmentId || args.envId || args.id);
  if (!row) return { ok: false, notFound: true, error: 'environment_not_found' };

  const deprovisionIdempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  if (
    deprovisionIdempotencyKey &&
    row.deprovisionIdempotencyKey === deprovisionIdempotencyKey &&
    row.status === CRM_DEMO_ENVIRONMENT_STATUS.DEPROVISIONED
  ) {
    return {
      ok: true,
      environment: serializeEnvironment(row),
      alreadyDeprovisioned: true,
    };
  }

  if (row.status === CRM_DEMO_ENVIRONMENT_STATUS.DEPROVISIONED) {
    return {
      ok: true,
      environment: serializeEnvironment(row),
      alreadyDeprovisioned: true,
    };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmDemoEnvironment.update({
    where: { id: row.id },
    data: {
      status: CRM_DEMO_ENVIRONMENT_STATUS.DEPROVISIONED,
      healthStatus: CRM_DEMO_ENVIRONMENT_HEALTH.UNKNOWN,
      logicalProvisionToken: null,
      deprovisionedAt: now,
      deprovisionIdempotencyKey:
        deprovisionIdempotencyKey || row.deprovisionIdempotencyKey,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: row.demoId,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_ENVIRONMENT_DEPROVISIONED,
    summary: `Demo environment deprovisioned ${row.envNumber}`,
    payload: { envId: row.id, envNumber: row.envNumber },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return { ok: true, environment: serializeEnvironment(updated) };
}

export async function getDemoEnvironment(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canViewDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_environment_forbidden' };
  }
  const row = await loadEnv(prisma, args.environmentId || args.envId || args.id);
  if (!row) return { ok: false, notFound: true, error: 'environment_not_found' };
  let dataPack = null;
  if (row.dataPackId && hasCrmDemoDataPackModel(prisma)) {
    try {
      const pack = await prisma.crmDemoDataPack.findUnique({
        where: { id: row.dataPackId },
      });
      dataPack = serializeDataPack(pack);
    } catch {
      dataPack = null;
    }
  }
  return { ok: true, environment: serializeEnvironment(row), dataPack };
}

export async function listDemoEnvironments(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canViewDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_environment_forbidden' };
  }
  if (!hasCrmDemoEnvironmentModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_environment_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  const where = {};
  if (args.demoId) {
    const demo = await loadDemo(prisma, args.demoId);
    if (demo) where.demoId = demo.id;
    else where.demoId = String(args.demoId).trim();
  }
  if (args.status) where.status = String(args.status).trim().toUpperCase();
  const take = Math.min(
    Math.max(Number(args.limit) || CRM_LIST_DEFAULT_LIMIT, 1),
    CRM_LIST_MAX_LIMIT
  );
  const rows = await prisma.crmDemoEnvironment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
  });
  return {
    ok: true,
    environments: rows.map(serializeEnvironment),
    count: rows.length,
  };
}
