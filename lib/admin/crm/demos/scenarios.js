/**
 * Demo Scenario versions — Phase 14 Wave 2.
 * ACTIVE immutable; SoD approve; pin to Demo.
 */

import {
  CRM_DEMO_CONTENT_CLASSIFICATION,
  CRM_DEMO_VERSION_STATUS,
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
} from '../catalogue.js';
import { hasCrmDemoModel, serializeDemo } from './model.js';
import {
  assertSafeJsonTree,
  assertSodApprover,
  canApproveDemoContent,
  canEditDemoContent,
  canViewDemoContent,
  isEditableStatus,
  nextVersionNumber,
  normalizeClassification,
  normalizeCode,
  resolveDemoContentAccess,
  retirePriorActive,
} from './versioning.js';

export function hasCrmDemoScenarioModel(prisma) {
  return typeof prisma?.crmDemoScenario?.create === 'function';
}

function serializeScenario(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    version: row.version,
    status: row.status,
    name: row.name || null,
    classification: row.classification || CRM_DEMO_CONTENT_CLASSIFICATION.INTERNAL,
    bodyJson: row.bodyJson ?? null,
    authoredByAdminId: row.authoredByAdminId || null,
    approvedByAdminId: row.approvedByAdminId || null,
    approvedAt: row.approvedAt ? new Date(row.approvedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    activeDirectlyEditable: false,
  };
}

async function loadScenario(prisma, scenarioId) {
  const id = scenarioId ? String(scenarioId).trim() : '';
  if (!id || !hasCrmDemoScenarioModel(prisma)) return null;
  try {
    return await prisma.crmDemoScenario.findUnique({ where: { id } });
  } catch {
    return null;
  }
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

export async function createScenarioVersion(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_scenario_forbidden' };
  }
  if (!hasCrmDemoScenarioModel(prisma)) {
    return { ok: false, error: 'crm_demo_scenario_model_unavailable', status: 'UNAVAILABLE' };
  }

  const code = normalizeCode(args.code);
  if (!code) return { ok: false, error: 'invalid_scenario_code' };

  const classification = normalizeClassification(
    args.classification,
    CRM_DEMO_CONTENT_CLASSIFICATION.INTERNAL
  );
  if (!classification) return { ok: false, error: 'invalid_classification' };

  let bodyJson;
  try {
    bodyJson = args.bodyJson !== undefined ? assertSafeJsonTree(args.bodyJson) : null;
  } catch {
    return { ok: false, error: 'executable_template_expressions_forbidden' };
  }

  const now = args.now || new Date();
  const version =
    args.version != null && !Number.isNaN(Number(args.version))
      ? Number(args.version)
      : await nextVersionNumber(prisma.crmDemoScenario, code);

  const row = await prisma.crmDemoScenario.create({
    data: {
      code,
      version,
      status: CRM_DEMO_VERSION_STATUS.DRAFT,
      name: args.name != null ? String(args.name).trim().slice(0, 200) : null,
      classification,
      bodyJson,
      authoredByAdminId: args.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    scenario: serializeScenario(row),
    meta: { activeDirectlyEditable: false, sodRequired: true },
  };
}

export async function updateScenarioVersion(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_scenario_forbidden' };
  }
  if (!hasCrmDemoScenarioModel(prisma)) {
    return { ok: false, error: 'crm_demo_scenario_model_unavailable', status: 'UNAVAILABLE' };
  }

  const row = await loadScenario(prisma, args.scenarioId);
  if (!row) return { ok: false, notFound: true, error: 'scenario_not_found' };

  if (row.status === CRM_DEMO_VERSION_STATUS.ACTIVE) {
    return {
      ok: false,
      error: 'active_demo_content_not_directly_editable',
      reason: 'create_new_version_required',
      scenario: serializeScenario(row),
    };
  }
  if (!isEditableStatus(row.status)) {
    return { ok: false, error: 'scenario_not_editable', status: row.status };
  }

  const patch = args.patch || {};
  const now = args.now || new Date();
  const data = { updatedAt: now };

  try {
    if (patch.name !== undefined) {
      data.name = patch.name != null ? String(patch.name).trim().slice(0, 200) : null;
    }
    if (patch.classification !== undefined) {
      const c = normalizeClassification(patch.classification);
      if (!c) return { ok: false, error: 'invalid_classification' };
      data.classification = c;
    }
    if (patch.bodyJson !== undefined) {
      data.bodyJson = patch.bodyJson != null ? assertSafeJsonTree(patch.bodyJson) : null;
    }
  } catch {
    return { ok: false, error: 'executable_template_expressions_forbidden' };
  }

  const updated = await prisma.crmDemoScenario.update({ where: { id: row.id }, data });
  return {
    ok: true,
    scenario: serializeScenario(updated),
    meta: { activeDirectlyEditable: false },
  };
}

export async function requestScenarioApproval(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_scenario_request_forbidden' };
  }
  if (!hasCrmDemoScenarioModel(prisma)) {
    return { ok: false, error: 'crm_demo_scenario_model_unavailable', status: 'UNAVAILABLE' };
  }

  const row = await loadScenario(prisma, args.scenarioId);
  if (!row) return { ok: false, notFound: true, error: 'scenario_not_found' };

  if (
    row.status !== CRM_DEMO_VERSION_STATUS.DRAFT &&
    row.status !== CRM_DEMO_VERSION_STATUS.REJECTED
  ) {
    return { ok: false, error: 'scenario_not_requestable', status: row.status };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmDemoScenario.update({
    where: { id: row.id },
    data: {
      status: CRM_DEMO_VERSION_STATUS.PENDING_APPROVAL,
      authoredByAdminId: args.admin?.id || row.authoredByAdminId,
      updatedAt: now,
    },
  });

  return { ok: true, scenario: serializeScenario(updated), meta: { sodRequired: true } };
}

export async function approveScenarioVersion(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canApproveDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_scenario_approve_forbidden' };
  }
  if (!hasCrmDemoScenarioModel(prisma)) {
    return { ok: false, error: 'crm_demo_scenario_model_unavailable', status: 'UNAVAILABLE' };
  }

  const row = await loadScenario(prisma, args.scenarioId);
  if (!row) return { ok: false, notFound: true, error: 'scenario_not_found' };

  if (row.status !== CRM_DEMO_VERSION_STATUS.PENDING_APPROVAL) {
    return { ok: false, error: 'scenario_not_pending_approval', status: row.status };
  }

  const sod = assertSodApprover(row, args.admin);
  if (!sod.ok) return sod;

  const now = args.now || new Date();
  await retirePriorActive(prisma.crmDemoScenario, row.code, now);

  const updated = await prisma.crmDemoScenario.update({
    where: { id: row.id },
    data: {
      status: CRM_DEMO_VERSION_STATUS.ACTIVE,
      approvedByAdminId: sod.approverId,
      approvedAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    scenario: serializeScenario(updated),
    meta: { sodRequired: true, activeDirectlyEditable: false },
  };
}

export async function listScenarioVersions(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canViewDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_scenario_list_forbidden', items: [] };
  }
  if (!hasCrmDemoScenarioModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'crm_demo_scenario_model_unavailable' },
    };
  }

  const where = {};
  if (args.code) where.code = normalizeCode(args.code) || String(args.code).trim().toUpperCase();
  if (args.status) where.status = String(args.status).trim().toUpperCase();

  const limit = Math.min(
    CRM_LIST_MAX_LIMIT,
    Math.max(1, Number(args.limit) || CRM_LIST_DEFAULT_LIMIT)
  );

  let rows = [];
  try {
    rows = await prisma.crmDemoScenario.findMany({
      where,
      orderBy: [{ code: 'asc' }, { version: 'desc' }],
      take: limit,
    });
  } catch {
    rows = [];
  }

  return {
    ok: true,
    items: (rows || []).map(serializeScenario),
    meta: { count: (rows || []).length, activeDirectlyEditable: false },
  };
}

export async function pinScenarioToDemo(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_scenario_pin_forbidden' };
  }
  if (!hasCrmDemoModel(prisma) || !hasCrmDemoScenarioModel(prisma)) {
    return { ok: false, error: 'crm_demo_scenario_model_unavailable', status: 'UNAVAILABLE' };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  const scenario = await loadScenario(prisma, args.scenarioId);
  if (!scenario) return { ok: false, notFound: true, error: 'scenario_not_found' };
  if (scenario.status !== CRM_DEMO_VERSION_STATUS.ACTIVE) {
    return { ok: false, error: 'demo_content_not_active', status: scenario.status };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmDemo.update({
    where: { id: demo.id },
    data: { pinnedScenarioId: scenario.id, updatedAt: now },
  });

  return {
    ok: true,
    demo: serializeDemo(updated),
    scenario: serializeScenario(scenario),
    meta: { pinned: true, historicalPinRetained: true },
  };
}

export { serializeScenario };
