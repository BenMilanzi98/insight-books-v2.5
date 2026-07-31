/**
 * CRM Activity/Task templates — Phase 13 Wave 4.
 * Versioned codes; ACTIVE rows are not directly editable (create a new version).
 * No executable expressions / arbitrary code.
 */

import {
  CRM_ACTIVITY_TEMPLATE_KIND,
  CRM_ACTIVITY_TEMPLATE_KINDS,
  CRM_ACTIVITY_TEMPLATE_STATUS,
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
} from './catalogue.js';
import { resolveCrmAccess } from './authz.js';

const KIND_SET = new Set(CRM_ACTIVITY_TEMPLATE_KINDS);
const FORBIDDEN_EXPR = /\$\{|`|<%|%>|javascript:|<\s*script|eval\s*\(/i;

export function hasCrmActivityTemplateModel(prisma) {
  return typeof prisma?.crmActivityTemplate?.create === 'function';
}

function serializeActivityTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    version: row.version,
    kind: row.kind,
    status: row.status,
    name: row.name || null,
    titleTemplate: row.titleTemplate || null,
    bodyTemplate: row.bodyTemplate || null,
    defaultsJson: row.defaultsJson ?? null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    activeDirectlyEditable: false,
  };
}

function assertSafeTemplateText(text) {
  const src = text == null ? '' : String(text);
  if (FORBIDDEN_EXPR.test(src)) {
    throw new Error('executable_template_expressions_forbidden');
  }
  return src;
}

/**
 * Create a new template version. To change an ACTIVE template, create a new version
 * (ACTIVE rows are never updated in place).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} args
 */
export async function createActivityTemplateVersion(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canEditActivities && !access.canEditLeads && !access.isSuperAdmin) {
    return { ok: false, forbidden: true, reason: 'crm_activity_template_forbidden' };
  }

  if (!hasCrmActivityTemplateModel(prisma)) {
    return {
      ok: false,
      error: 'crm_activity_template_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const code = args.code ? String(args.code).trim().toUpperCase() : '';
  if (!code || !/^[A-Z][A-Z0-9_]{1,63}$/.test(code)) {
    return { ok: false, error: 'invalid_template_code' };
  }

  const kind = String(args.kind || CRM_ACTIVITY_TEMPLATE_KIND.TASK)
    .trim()
    .toUpperCase();
  if (!KIND_SET.has(kind)) {
    return { ok: false, error: 'invalid_template_kind', allowed: CRM_ACTIVITY_TEMPLATE_KINDS };
  }

  let titleTemplate;
  let bodyTemplate;
  try {
    titleTemplate = assertSafeTemplateText(args.titleTemplate);
    bodyTemplate = assertSafeTemplateText(args.bodyTemplate);
  } catch {
    return { ok: false, error: 'executable_template_expressions_forbidden' };
  }

  const now = args.now || new Date();
  let version = args.version != null ? Number(args.version) : null;
  if (version == null || Number.isNaN(version) || version < 1) {
    try {
      const latest = await prisma.crmActivityTemplate.findFirst({
        where: { code },
        orderBy: { version: 'desc' },
      });
      version = latest ? latest.version + 1 : 1;
    } catch {
      version = 1;
    }
  }

  const status = String(args.status || CRM_ACTIVITY_TEMPLATE_STATUS.DRAFT)
    .trim()
    .toUpperCase();

  if (status === CRM_ACTIVITY_TEMPLATE_STATUS.ACTIVE) {
    try {
      await prisma.crmActivityTemplate.updateMany({
        where: { code, status: CRM_ACTIVITY_TEMPLATE_STATUS.ACTIVE },
        data: { status: CRM_ACTIVITY_TEMPLATE_STATUS.RETIRED, updatedAt: now },
      });
    } catch {
      // best-effort retire prior ACTIVE
    }
  }

  const row = await prisma.crmActivityTemplate.create({
    data: {
      code,
      version,
      kind,
      status,
      name: args.name != null ? String(args.name).trim().slice(0, 200) : null,
      titleTemplate,
      bodyTemplate,
      defaultsJson: args.defaultsJson ?? null,
      createdByAdminId: args.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    template: serializeActivityTemplate(row),
    meta: { activeDirectlyEditable: false, inventExecutionForbidden: true },
  };
}

/**
 * ACTIVE templates cannot be patched — callers must create a new version.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, templateId: string, patch: object }} args
 */
export async function updateActivityTemplate(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canEditActivities && !access.canEditLeads && !access.isSuperAdmin) {
    return { ok: false, forbidden: true, reason: 'crm_activity_template_forbidden' };
  }

  if (!hasCrmActivityTemplateModel(prisma)) {
    return {
      ok: false,
      error: 'crm_activity_template_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const templateId = args.templateId ? String(args.templateId).trim() : '';
  if (!templateId) return { ok: false, error: 'templateId_required' };

  let row = null;
  try {
    row = await prisma.crmActivityTemplate.findUnique({ where: { id: templateId } });
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'template_not_found' };

  if (row.status === CRM_ACTIVITY_TEMPLATE_STATUS.ACTIVE) {
    return {
      ok: false,
      error: 'active_template_not_directly_editable',
      reason: 'create_new_version_required',
      template: serializeActivityTemplate(row),
    };
  }

  const patch = args.patch || {};
  const now = args.now || new Date();
  const data = { updatedAt: now };
  if (patch.name !== undefined) {
    data.name = patch.name != null ? String(patch.name).trim().slice(0, 200) : null;
  }
  if (patch.titleTemplate !== undefined) {
    try {
      data.titleTemplate = assertSafeTemplateText(patch.titleTemplate);
    } catch {
      return { ok: false, error: 'executable_template_expressions_forbidden' };
    }
  }
  if (patch.bodyTemplate !== undefined) {
    try {
      data.bodyTemplate = assertSafeTemplateText(patch.bodyTemplate);
    } catch {
      return { ok: false, error: 'executable_template_expressions_forbidden' };
    }
  }
  if (patch.status !== undefined) {
    data.status = String(patch.status).trim().toUpperCase();
  }

  // DRAFT→ACTIVE (or any activate via update) must retire other ACTIVE versions for code
  if (data.status === CRM_ACTIVITY_TEMPLATE_STATUS.ACTIVE) {
    try {
      await prisma.crmActivityTemplate.updateMany({
        where: { code: row.code, status: CRM_ACTIVITY_TEMPLATE_STATUS.ACTIVE },
        data: { status: CRM_ACTIVITY_TEMPLATE_STATUS.RETIRED, updatedAt: now },
      });
    } catch {
      // best-effort retire prior ACTIVE
    }
  }

  const updated = await prisma.crmActivityTemplate.update({
    where: { id: templateId },
    data,
  });

  return {
    ok: true,
    template: serializeActivityTemplate(updated),
    meta: { activeDirectlyEditable: false },
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, code: string }} args
 */
export async function getActiveActivityTemplate(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewActivities &&
    !access.canViewLeads &&
    !access.canViewOpportunities
  ) {
    return { ok: false, forbidden: true, reason: 'crm_activity_template_view_forbidden' };
  }

  if (!hasCrmActivityTemplateModel(prisma)) {
    return {
      ok: true,
      template: null,
      status: 'UNAVAILABLE',
      reason: 'crm_activity_template_model_unavailable',
    };
  }

  const code = args.code ? String(args.code).trim().toUpperCase() : '';
  if (!code) return { ok: false, error: 'code_required' };

  let row = null;
  try {
    row = await prisma.crmActivityTemplate.findFirst({
      where: { code, status: CRM_ACTIVITY_TEMPLATE_STATUS.ACTIVE },
      orderBy: { version: 'desc' },
    });
  } catch {
    row = null;
  }

  return {
    ok: true,
    template: serializeActivityTemplate(row),
    meta: { activeDirectlyEditable: false },
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, code?: string, kind?: string, limit?: number|string }} args
 */
export async function listActivityTemplates(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewActivities &&
    !access.canViewLeads &&
    !access.canViewOpportunities
  ) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_activity_template_list_forbidden',
      items: [],
    };
  }

  if (!hasCrmActivityTemplateModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: {
        unavailable: true,
        reason: 'crm_activity_template_model_unavailable',
        status: 'UNAVAILABLE',
      },
    };
  }

  const where = {};
  if (args.code) where.code = String(args.code).trim().toUpperCase();
  if (args.kind) where.kind = String(args.kind).trim().toUpperCase();

  const limit = Math.min(
    CRM_LIST_MAX_LIMIT,
    Math.max(1, Number(args.limit) || CRM_LIST_DEFAULT_LIMIT)
  );

  let rows = [];
  try {
    rows = await prisma.crmActivityTemplate.findMany({
      where,
      orderBy: [{ code: 'asc' }, { version: 'desc' }],
      take: limit,
    });
  } catch {
    rows = [];
  }

  return {
    ok: true,
    items: (rows || []).map(serializeActivityTemplate),
    meta: { count: (rows || []).length, activeDirectlyEditable: false },
  };
}

export { serializeActivityTemplate };
