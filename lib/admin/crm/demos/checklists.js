/**
 * Demo checklists — Phase 14 Wave 3.
 * Versioned checklist definitions + execution; Critical fails block readiness.
 */

import {
  CRM_DEMO_CHECKLIST_EXECUTION_STATUS,
  CRM_DEMO_ISSUE_SEVERITY,
  CRM_DEMO_VERSION_STATUS,
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
  CRM_SUBJECT_TYPE,
  CRM_TIMELINE_EVENT_TYPE,
} from '../catalogue.js';
import { appendTimelineEvent } from '../timeline.js';
import { hasCrmDemoModel, serializeDemo } from './model.js';
import {
  assertSafeDemoContentText,
  assertSafeJsonTree,
  assertSodApprover,
  canApproveDemoContent,
  canEditDemoContent,
  canViewDemoContent,
  isEditableStatus,
  nextVersionNumber,
  normalizeCode,
  resolveDemoContentAccess,
  retirePriorActive,
} from './versioning.js';

export function hasCrmDemoChecklistModel(prisma) {
  return typeof prisma?.crmDemoChecklist?.create === 'function';
}

export function hasCrmDemoChecklistExecutionModel(prisma) {
  return typeof prisma?.crmDemoChecklistExecution?.create === 'function';
}

export function serializeChecklist(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    version: row.version,
    status: row.status,
    name: row.name || null,
    itemsJson: row.itemsJson ?? null,
    authoredByAdminId: row.authoredByAdminId || null,
    approvedByAdminId: row.approvedByAdminId || null,
    approvedAt: row.approvedAt ? new Date(row.approvedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    activeDirectlyEditable: false,
  };
}

export function serializeChecklistExecution(row) {
  if (!row) return null;
  return {
    id: row.id,
    demoId: row.demoId,
    checklistId: row.checklistId,
    status: row.status,
    resultsJson: row.resultsJson ?? null,
    criticalFailed: row.criticalFailed === true,
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    executedByAdminId: row.executedByAdminId || null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

async function loadChecklist(prisma, checklistId) {
  const id = checklistId ? String(checklistId).trim() : '';
  if (!id || !hasCrmDemoChecklistModel(prisma)) return null;
  try {
    return await prisma.crmDemoChecklist.findUnique({ where: { id } });
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

function normaliseItems(itemsJson) {
  if (!Array.isArray(itemsJson)) return [];
  return itemsJson.map((it, idx) => ({
    key: String(it.key || `item_${idx + 1}`).trim(),
    label: String(it.label || it.key || `Item ${idx + 1}`).trim(),
    severity: String(it.severity || CRM_DEMO_ISSUE_SEVERITY.WARN)
      .trim()
      .toUpperCase(),
    required: it.required !== false,
  }));
}

export async function createChecklistVersion(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_checklist_forbidden' };
  }
  if (!hasCrmDemoChecklistModel(prisma)) {
    return { ok: false, error: 'crm_demo_checklist_model_unavailable', status: 'UNAVAILABLE' };
  }

  const code = normalizeCode(args.code);
  if (!code) return { ok: false, error: 'invalid_checklist_code' };

  let itemsJson;
  try {
    assertSafeDemoContentText(args.name || '');
    itemsJson =
      args.itemsJson !== undefined
        ? assertSafeJsonTree(args.itemsJson)
        : [{ key: 'prep', label: 'Prep complete', severity: 'CRITICAL', required: true }];
  } catch {
    return { ok: false, error: 'executable_template_expressions_forbidden' };
  }

  const now = args.now || new Date();
  const version =
    args.version != null && !Number.isNaN(Number(args.version))
      ? Number(args.version)
      : await nextVersionNumber(prisma.crmDemoChecklist, code);

  try {
    const row = await prisma.crmDemoChecklist.create({
      data: {
        code,
        version,
        status: CRM_DEMO_VERSION_STATUS.DRAFT,
        name: args.name != null ? String(args.name).trim().slice(0, 200) : null,
        itemsJson,
        authoredByAdminId: args.admin?.id || null,
        createdAt: now,
        updatedAt: now,
      },
    });
    return { ok: true, checklist: serializeChecklist(row) };
  } catch (err) {
    if (err?.code === 'P2002') return { ok: false, error: 'checklist_version_conflict' };
    return { ok: false, error: err?.message || 'checklist_create_failed' };
  }
}

export async function updateChecklistVersion(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_checklist_forbidden' };
  }
  const row = await loadChecklist(prisma, args.checklistId || args.id);
  if (!row) return { ok: false, notFound: true, error: 'checklist_not_found' };
  if (!isEditableStatus(row.status)) {
    return { ok: false, error: 'active_demo_content_not_directly_editable' };
  }
  const patch = args.patch || args;
  let itemsJson = row.itemsJson;
  try {
    if (patch.itemsJson !== undefined) {
      itemsJson = assertSafeJsonTree(patch.itemsJson);
    }
    if (patch.name !== undefined) assertSafeDemoContentText(patch.name || '');
  } catch {
    return { ok: false, error: 'executable_template_expressions_forbidden' };
  }
  const updated = await prisma.crmDemoChecklist.update({
    where: { id: row.id },
    data: {
      name:
        patch.name !== undefined
          ? String(patch.name || '').trim().slice(0, 200) || null
          : row.name,
      itemsJson,
      updatedAt: args.now || new Date(),
    },
  });
  return { ok: true, checklist: serializeChecklist(updated) };
}

export async function requestChecklistApproval(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_checklist_forbidden' };
  }
  const row = await loadChecklist(prisma, args.checklistId || args.id);
  if (!row) return { ok: false, notFound: true, error: 'checklist_not_found' };
  if (!isEditableStatus(row.status)) {
    return { ok: false, error: 'checklist_not_requestable' };
  }
  const updated = await prisma.crmDemoChecklist.update({
    where: { id: row.id },
    data: {
      status: CRM_DEMO_VERSION_STATUS.PENDING_APPROVAL,
      updatedAt: args.now || new Date(),
    },
  });
  return { ok: true, checklist: serializeChecklist(updated) };
}

export async function approveChecklistVersion(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canApproveDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_checklist_approve_forbidden' };
  }
  const row = await loadChecklist(prisma, args.checklistId || args.id);
  if (!row) return { ok: false, notFound: true, error: 'checklist_not_found' };
  if (row.status !== CRM_DEMO_VERSION_STATUS.PENDING_APPROVAL) {
    return { ok: false, error: 'checklist_not_pending_approval' };
  }
  const sod = assertSodApprover(row, args.admin);
  if (!sod.ok) return sod;

  const now = args.now || new Date();
  await retirePriorActive(prisma.crmDemoChecklist, row.code, now);
  const updated = await prisma.crmDemoChecklist.update({
    where: { id: row.id },
    data: {
      status: CRM_DEMO_VERSION_STATUS.ACTIVE,
      approvedByAdminId: sod.approverId,
      approvedAt: now,
      updatedAt: now,
    },
  });
  return { ok: true, checklist: serializeChecklist(updated) };
}

export async function listChecklistVersions(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canViewDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_checklist_forbidden' };
  }
  if (!hasCrmDemoChecklistModel(prisma)) {
    return { ok: false, error: 'crm_demo_checklist_model_unavailable', status: 'UNAVAILABLE' };
  }
  const where = {};
  if (args.code) where.code = normalizeCode(args.code) || String(args.code).trim();
  if (args.status) where.status = String(args.status).trim().toUpperCase();
  const take = Math.min(
    Math.max(Number(args.limit) || CRM_LIST_DEFAULT_LIMIT, 1),
    CRM_LIST_MAX_LIMIT
  );
  const rows = await prisma.crmDemoChecklist.findMany({
    where,
    orderBy: [{ code: 'asc' }, { version: 'desc' }],
    take,
  });
  return { ok: true, checklists: rows.map(serializeChecklist), count: rows.length };
}

export async function pinChecklistToDemo(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_checklist_forbidden' };
  }
  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };
  const checklist = await loadChecklist(prisma, args.checklistId || args.id);
  if (!checklist) return { ok: false, notFound: true, error: 'checklist_not_found' };
  if (checklist.status !== CRM_DEMO_VERSION_STATUS.ACTIVE) {
    return { ok: false, error: 'demo_content_not_active' };
  }
  const now = args.now || new Date();
  const updated = await prisma.crmDemo.update({
    where: { id: demo.id },
    data: { pinnedChecklistId: checklist.id, updatedAt: now },
  });
  return {
    ok: true,
    demo: serializeDemo(updated),
    checklist: serializeChecklist(checklist),
  };
}

/**
 * Execute a versioned checklist against a Demo.
 * results: [{ key, ok, severity? }]
 * Critical failed items → status FAILED + criticalFailed true.
 */
export async function executeDemoChecklist(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_checklist_forbidden' };
  }
  if (!hasCrmDemoChecklistExecutionModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_checklist_execution_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  const checklistId = args.checklistId || demo.pinnedChecklistId;
  const checklist = await loadChecklist(prisma, checklistId);
  if (!checklist) return { ok: false, notFound: true, error: 'checklist_not_found' };
  if (checklist.status !== CRM_DEMO_VERSION_STATUS.ACTIVE) {
    return { ok: false, error: 'demo_content_not_active' };
  }

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  if (idempotencyKey) {
    try {
      const existing = await prisma.crmDemoChecklistExecution.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return {
          ok: true,
          execution: serializeChecklistExecution(existing),
          alreadyExists: true,
        };
      }
    } catch {
      // continue
    }
  }

  const items = normaliseItems(checklist.itemsJson);
  const resultMap = new Map();
  const rawResults = Array.isArray(args.results) ? args.results : [];
  for (const r of rawResults) {
    resultMap.set(String(r.key || '').trim(), {
      ok: r.ok === true,
      severity: String(r.severity || '').trim().toUpperCase() || null,
      detail: r.detail || null,
    });
  }

  const resultsJson = items.map((item) => {
    const got = resultMap.get(item.key);
    const ok = got ? got.ok === true : false;
    return {
      key: item.key,
      label: item.label,
      severity: item.severity,
      required: item.required,
      ok,
      detail: got?.detail || null,
    };
  });

  const criticalFailed = resultsJson.some(
    (r) =>
      !r.ok &&
      r.required &&
      r.severity === CRM_DEMO_ISSUE_SEVERITY.CRITICAL
  );
  const anyRequiredFailed = resultsJson.some((r) => !r.ok && r.required);
  const status = criticalFailed || anyRequiredFailed
    ? CRM_DEMO_CHECKLIST_EXECUTION_STATUS.FAILED
    : CRM_DEMO_CHECKLIST_EXECUTION_STATUS.PASSED;

  const now = args.now || new Date();
  try {
    const row = await prisma.crmDemoChecklistExecution.create({
      data: {
        demoId: demo.id,
        checklistId: checklist.id,
        status,
        resultsJson,
        criticalFailed,
        completedAt: now,
        executedByAdminId: args.admin?.id || null,
        idempotencyKey,
        createdAt: now,
        updatedAt: now,
      },
    });

    await prisma.crmDemo.update({
      where: { id: demo.id },
      data: {
        pinnedChecklistId: checklist.id,
        latestChecklistExecutionId: row.id,
        updatedAt: now,
      },
    });

    await appendTimelineEvent(prisma, {
      subjectType: CRM_SUBJECT_TYPE.DEMO,
      subjectId: demo.id,
      eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_CHECKLIST_EXECUTED,
      summary: `Demo checklist ${status}${criticalFailed ? ' (Critical fails)' : ''}`,
      payload: {
        executionId: row.id,
        checklistId: checklist.id,
        status,
        criticalFailed,
      },
      actorAdminId: args.admin?.id || null,
      at: now,
    });

    return {
      ok: true,
      execution: serializeChecklistExecution(row),
      criticalFailed,
      status,
    };
  } catch (err) {
    if (idempotencyKey && err?.code === 'P2002') {
      const raced = await prisma.crmDemoChecklistExecution.findUnique({
        where: { idempotencyKey },
      });
      if (raced) {
        return {
          ok: true,
          execution: serializeChecklistExecution(raced),
          alreadyExists: true,
        };
      }
    }
    return { ok: false, error: err?.message || 'checklist_execution_failed' };
  }
}
