/**
 * Demo Script versions — Phase 14 Wave 2.
 * RESTRICTED never on Customer/invitation surfaces; en/ny label foundations.
 * ACTIVE immutable; SoD approve.
 */

import {
  CRM_DEMO_CONTENT_CLASSIFICATION,
  CRM_DEMO_PROJECTION_SURFACE,
  CRM_DEMO_VERSION_STATUS,
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
} from '../catalogue.js';
import { hasCrmDemoModel, serializeDemo } from './model.js';
import {
  assertSafeDemoContentText,
  assertSafeJsonTree,
  assertSodApprover,
  canApproveDemoContent,
  canEditDemoContent,
  canViewDemoContent,
  isEditableStatus,
  isExternalSurface,
  nextVersionNumber,
  normalizeClassification,
  normalizeCode,
  resolveDemoContentAccess,
  retirePriorActive,
} from './versioning.js';

export function hasCrmDemoScriptModel(prisma) {
  return typeof prisma?.crmDemoScript?.create === 'function';
}

function serializeScript(row, { omitInternal = false } = {}) {
  if (!row) return null;
  const base = {
    id: row.id,
    code: row.code,
    version: row.version,
    status: row.status,
    name: row.name || null,
    classification: row.classification || CRM_DEMO_CONTENT_CLASSIFICATION.INTERNAL,
    bodyCustomerSafe: row.bodyCustomerSafe || null,
    labelsJson: row.labelsJson ?? null,
    authoredByAdminId: row.authoredByAdminId || null,
    approvedByAdminId: row.approvedByAdminId || null,
    approvedAt: row.approvedAt ? new Date(row.approvedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    activeDirectlyEditable: false,
  };
  if (!omitInternal) {
    base.bodyInternal = row.bodyInternal || null;
  }
  return base;
}

async function loadScript(prisma, scriptId) {
  const id = scriptId ? String(scriptId).trim() : '';
  if (!id || !hasCrmDemoScriptModel(prisma)) return null;
  try {
    return await prisma.crmDemoScript.findUnique({ where: { id } });
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

export async function createScriptVersion(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_script_forbidden' };
  }
  if (!hasCrmDemoScriptModel(prisma)) {
    return { ok: false, error: 'crm_demo_script_model_unavailable', status: 'UNAVAILABLE' };
  }

  const code = normalizeCode(args.code);
  if (!code) return { ok: false, error: 'invalid_script_code' };

  const classification = normalizeClassification(args.classification);
  if (!classification) {
    return {
      ok: false,
      error: 'invalid_classification',
      allowed: Object.values(CRM_DEMO_CONTENT_CLASSIFICATION),
    };
  }

  let bodyInternal;
  let bodyCustomerSafe;
  let labelsJson;
  try {
    bodyInternal = assertSafeDemoContentText(args.bodyInternal || '');
    bodyCustomerSafe = assertSafeDemoContentText(args.bodyCustomerSafe || '');
    labelsJson =
      args.labelsJson !== undefined ? assertSafeJsonTree(args.labelsJson) : null;
  } catch {
    return { ok: false, error: 'executable_template_expressions_forbidden' };
  }

  const now = args.now || new Date();
  const version =
    args.version != null && !Number.isNaN(Number(args.version))
      ? Number(args.version)
      : await nextVersionNumber(prisma.crmDemoScript, code);

  const row = await prisma.crmDemoScript.create({
    data: {
      code,
      version,
      status: CRM_DEMO_VERSION_STATUS.DRAFT,
      name: args.name != null ? String(args.name).trim().slice(0, 200) : null,
      classification,
      bodyInternal: bodyInternal || null,
      bodyCustomerSafe: bodyCustomerSafe || null,
      labelsJson,
      authoredByAdminId: args.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    script: serializeScript(row),
    meta: {
      activeDirectlyEditable: false,
      sodRequired: true,
      restrictedNeverOnCustomer: true,
      inventAiScriptForbidden: true,
    },
  };
}

export async function updateScriptVersion(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_script_forbidden' };
  }
  if (!hasCrmDemoScriptModel(prisma)) {
    return { ok: false, error: 'crm_demo_script_model_unavailable', status: 'UNAVAILABLE' };
  }

  const row = await loadScript(prisma, args.scriptId);
  if (!row) return { ok: false, notFound: true, error: 'script_not_found' };

  if (row.status === CRM_DEMO_VERSION_STATUS.ACTIVE) {
    return {
      ok: false,
      error: 'active_demo_content_not_directly_editable',
      reason: 'create_new_version_required',
      script: serializeScript(row),
    };
  }
  if (!isEditableStatus(row.status)) {
    return { ok: false, error: 'script_not_editable', status: row.status };
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
    if (patch.bodyInternal !== undefined) {
      data.bodyInternal = assertSafeDemoContentText(patch.bodyInternal || '') || null;
    }
    if (patch.bodyCustomerSafe !== undefined) {
      data.bodyCustomerSafe =
        assertSafeDemoContentText(patch.bodyCustomerSafe || '') || null;
    }
    if (patch.labelsJson !== undefined) {
      data.labelsJson =
        patch.labelsJson != null ? assertSafeJsonTree(patch.labelsJson) : null;
    }
  } catch {
    return { ok: false, error: 'executable_template_expressions_forbidden' };
  }

  const updated = await prisma.crmDemoScript.update({ where: { id: row.id }, data });
  return { ok: true, script: serializeScript(updated), meta: { activeDirectlyEditable: false } };
}

export async function requestScriptApproval(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_script_request_forbidden' };
  }
  if (!hasCrmDemoScriptModel(prisma)) {
    return { ok: false, error: 'crm_demo_script_model_unavailable', status: 'UNAVAILABLE' };
  }

  const row = await loadScript(prisma, args.scriptId);
  if (!row) return { ok: false, notFound: true, error: 'script_not_found' };

  if (
    row.status !== CRM_DEMO_VERSION_STATUS.DRAFT &&
    row.status !== CRM_DEMO_VERSION_STATUS.REJECTED
  ) {
    return { ok: false, error: 'script_not_requestable', status: row.status };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmDemoScript.update({
    where: { id: row.id },
    data: {
      status: CRM_DEMO_VERSION_STATUS.PENDING_APPROVAL,
      authoredByAdminId: args.admin?.id || row.authoredByAdminId,
      updatedAt: now,
    },
  });

  return { ok: true, script: serializeScript(updated), meta: { sodRequired: true } };
}

export async function approveScriptVersion(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canApproveDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_script_approve_forbidden' };
  }
  if (!hasCrmDemoScriptModel(prisma)) {
    return { ok: false, error: 'crm_demo_script_model_unavailable', status: 'UNAVAILABLE' };
  }

  const row = await loadScript(prisma, args.scriptId);
  if (!row) return { ok: false, notFound: true, error: 'script_not_found' };

  if (row.status !== CRM_DEMO_VERSION_STATUS.PENDING_APPROVAL) {
    return { ok: false, error: 'script_not_pending_approval', status: row.status };
  }

  const sod = assertSodApprover(row, args.admin);
  if (!sod.ok) return sod;

  const now = args.now || new Date();
  await retirePriorActive(prisma.crmDemoScript, row.code, now);

  const updated = await prisma.crmDemoScript.update({
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
    script: serializeScript(updated),
    meta: { sodRequired: true, activeDirectlyEditable: false },
  };
}

export async function listScriptVersions(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canViewDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_script_list_forbidden', items: [] };
  }
  if (!hasCrmDemoScriptModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'crm_demo_script_model_unavailable' },
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
    rows = await prisma.crmDemoScript.findMany({
      where,
      orderBy: [{ code: 'asc' }, { version: 'desc' }],
      take: limit,
    });
  } catch {
    rows = [];
  }

  const canRestricted = Boolean(access.canViewRestrictedNotes || access.isSuperAdmin);
  return {
    ok: true,
    items: (rows || []).map((r) => {
      if (
        r.classification === CRM_DEMO_CONTENT_CLASSIFICATION.RESTRICTED &&
        !canRestricted
      ) {
        return serializeScript(r, { omitInternal: true });
      }
      return serializeScript(r);
    }),
    meta: {
      count: (rows || []).length,
      activeDirectlyEditable: false,
      restrictedOmitted: !canRestricted,
    },
  };
}

/**
 * Fail-closed: RESTRICTED never on CUSTOMER / INVITATION.
 * INTERNAL surface still requires canViewRestricted for RESTRICTED bodies.
 */
export function projectScriptForSurface(script, opts = {}) {
  if (!script) {
    return { ok: true, allowed: false, script: null, reason: 'script_missing' };
  }

  const surface = String(opts.surface || CRM_DEMO_PROJECTION_SURFACE.INTERNAL)
    .trim()
    .toUpperCase();
  const classification = String(
    script.classification || CRM_DEMO_CONTENT_CLASSIFICATION.INTERNAL
  )
    .trim()
    .toUpperCase();
  const canViewRestricted = Boolean(opts.canViewRestricted);

  if (classification === CRM_DEMO_CONTENT_CLASSIFICATION.RESTRICTED) {
    if (isExternalSurface(surface)) {
      return {
        ok: true,
        allowed: false,
        script: null,
        reason: 'restricted_script_forbidden_on_customer_surface',
        meta: { surface, classification },
      };
    }
    if (!canViewRestricted) {
      return {
        ok: true,
        allowed: false,
        script: null,
        reason: 'restricted_script_privilege_required',
        meta: { surface, classification },
      };
    }
    return {
      ok: true,
      allowed: true,
      script: serializeScript(script),
      meta: { surface, classification },
    };
  }

  if (isExternalSurface(surface)) {
    if (classification === CRM_DEMO_CONTENT_CLASSIFICATION.INTERNAL) {
      return {
        ok: true,
        allowed: Boolean(script.bodyCustomerSafe),
        script: script.bodyCustomerSafe
          ? {
              id: script.id,
              code: script.code,
              version: script.version,
              status: script.status,
              name: script.name || null,
              classification,
              bodyCustomerSafe: script.bodyCustomerSafe,
              labelsJson: script.labelsJson ?? null,
            }
          : null,
        reason: script.bodyCustomerSafe
          ? null
          : 'internal_script_has_no_customer_safe_body',
        meta: { surface, classification, bodyInternalOmitted: true },
      };
    }
    // CUSTOMER_SAFE
    return {
      ok: true,
      allowed: true,
      script: {
        id: script.id,
        code: script.code,
        version: script.version,
        status: script.status,
        name: script.name || null,
        classification,
        bodyCustomerSafe: script.bodyCustomerSafe || null,
        labelsJson: script.labelsJson ?? null,
      },
      meta: { surface, classification, bodyInternalOmitted: true },
    };
  }

  return {
    ok: true,
    allowed: true,
    script: serializeScript(script),
    meta: { surface, classification },
  };
}

export async function pinScriptToDemo(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_script_pin_forbidden' };
  }
  if (!hasCrmDemoModel(prisma) || !hasCrmDemoScriptModel(prisma)) {
    return { ok: false, error: 'crm_demo_script_model_unavailable', status: 'UNAVAILABLE' };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  const script = await loadScript(prisma, args.scriptId);
  if (!script) return { ok: false, notFound: true, error: 'script_not_found' };
  if (script.status !== CRM_DEMO_VERSION_STATUS.ACTIVE) {
    return { ok: false, error: 'demo_content_not_active', status: script.status };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmDemo.update({
    where: { id: demo.id },
    data: { pinnedScriptId: script.id, updatedAt: now },
  });

  return {
    ok: true,
    demo: serializeDemo(updated),
    script: serializeScript(script),
    meta: { pinned: true, historicalPinRetained: true },
  };
}

export { serializeScript };
