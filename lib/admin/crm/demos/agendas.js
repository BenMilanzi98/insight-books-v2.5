/**
 * Demo Agenda versions — Phase 14 Wave 2.
 * ACTIVE immutable in place; SoD approve; customer-safe projection for invitations.
 */

import {
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
  normalizeCode,
  resolveDemoContentAccess,
  retirePriorActive,
} from './versioning.js';

export function hasCrmDemoAgendaModel(prisma) {
  return typeof prisma?.crmDemoAgenda?.create === 'function';
}

function serializeAgenda(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    version: row.version,
    status: row.status,
    name: row.name || null,
    itemsJson: row.itemsJson ?? null,
    customerSafeSummary: row.customerSafeSummary || null,
    authoredByAdminId: row.authoredByAdminId || null,
    approvedByAdminId: row.approvedByAdminId || null,
    approvedAt: row.approvedAt ? new Date(row.approvedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    activeDirectlyEditable: false,
  };
}

async function loadAgenda(prisma, agendaId) {
  const id = agendaId ? String(agendaId).trim() : '';
  if (!id || !hasCrmDemoAgendaModel(prisma)) return null;
  try {
    return await prisma.crmDemoAgenda.findUnique({ where: { id } });
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

export async function createAgendaVersion(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_agenda_forbidden' };
  }
  if (!hasCrmDemoAgendaModel(prisma)) {
    return { ok: false, error: 'crm_demo_agenda_model_unavailable', status: 'UNAVAILABLE' };
  }

  const code = normalizeCode(args.code);
  if (!code) return { ok: false, error: 'invalid_agenda_code' };

  let customerSafeSummary;
  let itemsJson;
  try {
    customerSafeSummary = assertSafeDemoContentText(args.customerSafeSummary || '');
    itemsJson =
      args.itemsJson !== undefined ? assertSafeJsonTree(args.itemsJson) : null;
  } catch {
    return { ok: false, error: 'executable_template_expressions_forbidden' };
  }

  const now = args.now || new Date();
  const version =
    args.version != null && !Number.isNaN(Number(args.version))
      ? Number(args.version)
      : await nextVersionNumber(prisma.crmDemoAgenda, code);

  const row = await prisma.crmDemoAgenda.create({
    data: {
      code,
      version,
      status: CRM_DEMO_VERSION_STATUS.DRAFT,
      name: args.name != null ? String(args.name).trim().slice(0, 200) : null,
      itemsJson,
      customerSafeSummary: customerSafeSummary || null,
      authoredByAdminId: args.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    agenda: serializeAgenda(row),
    meta: {
      activeDirectlyEditable: false,
      sodRequired: true,
      inventExecutableForbidden: true,
    },
  };
}

export async function updateAgendaVersion(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_agenda_forbidden' };
  }
  if (!hasCrmDemoAgendaModel(prisma)) {
    return { ok: false, error: 'crm_demo_agenda_model_unavailable', status: 'UNAVAILABLE' };
  }

  const row = await loadAgenda(prisma, args.agendaId);
  if (!row) return { ok: false, notFound: true, error: 'agenda_not_found' };

  if (row.status === CRM_DEMO_VERSION_STATUS.ACTIVE) {
    return {
      ok: false,
      error: 'active_demo_content_not_directly_editable',
      reason: 'create_new_version_required',
      agenda: serializeAgenda(row),
    };
  }
  if (!isEditableStatus(row.status)) {
    return { ok: false, error: 'agenda_not_editable', status: row.status };
  }

  const patch = args.patch || {};
  const now = args.now || new Date();
  const data = { updatedAt: now };

  try {
    if (patch.name !== undefined) {
      data.name = patch.name != null ? String(patch.name).trim().slice(0, 200) : null;
    }
    if (patch.customerSafeSummary !== undefined) {
      data.customerSafeSummary = assertSafeDemoContentText(patch.customerSafeSummary || '') || null;
    }
    if (patch.itemsJson !== undefined) {
      data.itemsJson = patch.itemsJson != null ? assertSafeJsonTree(patch.itemsJson) : null;
    }
  } catch {
    return { ok: false, error: 'executable_template_expressions_forbidden' };
  }

  const updated = await prisma.crmDemoAgenda.update({ where: { id: row.id }, data });
  return { ok: true, agenda: serializeAgenda(updated), meta: { activeDirectlyEditable: false } };
}

export async function requestAgendaApproval(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_agenda_request_forbidden' };
  }
  if (!hasCrmDemoAgendaModel(prisma)) {
    return { ok: false, error: 'crm_demo_agenda_model_unavailable', status: 'UNAVAILABLE' };
  }

  const row = await loadAgenda(prisma, args.agendaId);
  if (!row) return { ok: false, notFound: true, error: 'agenda_not_found' };

  if (
    row.status !== CRM_DEMO_VERSION_STATUS.DRAFT &&
    row.status !== CRM_DEMO_VERSION_STATUS.REJECTED
  ) {
    return { ok: false, error: 'agenda_not_requestable', status: row.status };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmDemoAgenda.update({
    where: { id: row.id },
    data: {
      status: CRM_DEMO_VERSION_STATUS.PENDING_APPROVAL,
      authoredByAdminId: args.admin?.id || row.authoredByAdminId,
      updatedAt: now,
    },
  });

  return { ok: true, agenda: serializeAgenda(updated), meta: { sodRequired: true } };
}

export async function approveAgendaVersion(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canApproveDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_agenda_approve_forbidden' };
  }
  if (!hasCrmDemoAgendaModel(prisma)) {
    return { ok: false, error: 'crm_demo_agenda_model_unavailable', status: 'UNAVAILABLE' };
  }

  const row = await loadAgenda(prisma, args.agendaId);
  if (!row) return { ok: false, notFound: true, error: 'agenda_not_found' };

  if (row.status !== CRM_DEMO_VERSION_STATUS.PENDING_APPROVAL) {
    return { ok: false, error: 'agenda_not_pending_approval', status: row.status };
  }

  const sod = assertSodApprover(row, args.admin);
  if (!sod.ok) return sod;

  const now = args.now || new Date();
  await retirePriorActive(prisma.crmDemoAgenda, row.code, now);

  const updated = await prisma.crmDemoAgenda.update({
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
    agenda: serializeAgenda(updated),
    meta: { sodRequired: true, activeDirectlyEditable: false },
  };
}

export async function listAgendaVersions(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canViewDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_agenda_list_forbidden', items: [] };
  }
  if (!hasCrmDemoAgendaModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'crm_demo_agenda_model_unavailable' },
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
    rows = await prisma.crmDemoAgenda.findMany({
      where,
      orderBy: [{ code: 'asc' }, { version: 'desc' }],
      take: limit,
    });
  } catch {
    rows = [];
  }

  return {
    ok: true,
    items: (rows || []).map(serializeAgenda),
    meta: { count: (rows || []).length, activeDirectlyEditable: false },
  };
}

/**
 * Customer / invitation: summary only. Internal: full items.
 */
export function projectAgendaForSurface(agenda, opts = {}) {
  if (!agenda) {
    return { ok: true, allowed: false, agenda: null, reason: 'agenda_missing' };
  }
  const surface = String(opts.surface || CRM_DEMO_PROJECTION_SURFACE.INTERNAL)
    .trim()
    .toUpperCase();

  if (isExternalSurface(surface)) {
    return {
      ok: true,
      allowed: true,
      agenda: {
        id: agenda.id,
        code: agenda.code,
        version: agenda.version,
        status: agenda.status,
        name: agenda.name || null,
        customerSafeSummary: agenda.customerSafeSummary || null,
      },
      meta: { surface, itemsOmitted: true },
    };
  }

  return {
    ok: true,
    allowed: true,
    agenda: serializeAgenda(agenda),
    meta: { surface },
  };
}

export async function pinAgendaToDemo(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_agenda_pin_forbidden' };
  }
  if (!hasCrmDemoModel(prisma) || !hasCrmDemoAgendaModel(prisma)) {
    return { ok: false, error: 'crm_demo_agenda_model_unavailable', status: 'UNAVAILABLE' };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  const agenda = await loadAgenda(prisma, args.agendaId);
  if (!agenda) return { ok: false, notFound: true, error: 'agenda_not_found' };
  if (agenda.status !== CRM_DEMO_VERSION_STATUS.ACTIVE) {
    return { ok: false, error: 'demo_content_not_active', status: agenda.status };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmDemo.update({
    where: { id: demo.id },
    data: { pinnedAgendaId: agenda.id, updatedAt: now },
  });

  return {
    ok: true,
    demo: serializeDemo(updated),
    agenda: serializeAgenda(agenda),
    meta: { pinned: true, historicalPinRetained: true },
  };
}

export { serializeAgenda };
