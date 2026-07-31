/**
 * Shared Demo content versioning helpers — Phase 14 Wave 2.
 * ACTIVE not directly editable; SoD author ≠ approver; no executable expressions.
 */

import {
  CRM_DEMO_CONTENT_CLASSIFICATION,
  CRM_DEMO_CONTENT_CLASSIFICATIONS,
  CRM_DEMO_PROJECTION_SURFACE,
  CRM_DEMO_VERSION_STATUS,
  CRM_DEMO_VERSION_STATUSES,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';

const FORBIDDEN_EXPR = /\$\{|`|<%|%>|javascript:|<\s*script|eval\s*\(/i;
const STATUS_SET = new Set(CRM_DEMO_VERSION_STATUSES);
const CLASS_SET = new Set(CRM_DEMO_CONTENT_CLASSIFICATIONS);
const EDITABLE = new Set([
  CRM_DEMO_VERSION_STATUS.DRAFT,
  CRM_DEMO_VERSION_STATUS.REJECTED,
]);

export function assertSafeDemoContentText(text) {
  const src = text == null ? '' : String(text);
  if (FORBIDDEN_EXPR.test(src)) {
    throw new Error('executable_template_expressions_forbidden');
  }
  return src;
}

export function assertSafeJsonTree(value, path = 'root') {
  if (value == null) return value;
  if (typeof value === 'string') {
    assertSafeDemoContentText(value);
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertSafeJsonTree(v, `${path}[${i}]`));
    return value;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      assertSafeDemoContentText(k);
      assertSafeJsonTree(v, `${path}.${k}`);
    }
    return value;
  }
  return value;
}

export function normalizeCode(raw) {
  const code = raw ? String(raw).trim().toUpperCase() : '';
  if (!code || !/^[A-Z][A-Z0-9_]{1,63}$/.test(code)) return null;
  return code;
}

export function normalizeClassification(raw, fallback = CRM_DEMO_CONTENT_CLASSIFICATION.INTERNAL) {
  const c = String(raw || fallback).trim().toUpperCase();
  return CLASS_SET.has(c) ? c : null;
}

export function canEditDemoContent(access) {
  return (
    access.canEditActivities ||
    access.canEditLeads ||
    access.canEditOpportunities ||
    access.canCreateLeads ||
    access.isSuperAdmin
  );
}

export function canViewDemoContent(access) {
  return (
    access.canViewActivities ||
    access.canViewLeads ||
    access.canViewOpportunities ||
    access.canView ||
    access.isSuperAdmin
  );
}

export function canApproveDemoContent(access) {
  return (
    access.canApproveMerge ||
    access.canEditActivities ||
    access.isSuperAdmin
  );
}

export async function nextVersionNumber(prismaDelegate, code) {
  try {
    const latest = await prismaDelegate.findFirst({
      where: { code },
      orderBy: { version: 'desc' },
    });
    return latest ? latest.version + 1 : 1;
  } catch {
    return 1;
  }
}

export async function retirePriorActive(prismaDelegate, code, now) {
  try {
    await prismaDelegate.updateMany({
      where: { code, status: CRM_DEMO_VERSION_STATUS.ACTIVE },
      data: { status: CRM_DEMO_VERSION_STATUS.RETIRED, updatedAt: now },
    });
  } catch {
    // best-effort
  }
}

/**
 * SoD: approver must differ from author (authoredByAdminId / requestedByAdminId).
 */
export function assertSodApprover(row, admin) {
  const approverId = admin?.id ? String(admin.id) : '';
  if (!approverId) {
    return { ok: false, error: 'approver_required' };
  }
  const authorId = row.authoredByAdminId
    ? String(row.authoredByAdminId)
    : row.requestedByAdminId
      ? String(row.requestedByAdminId)
      : '';
  if (authorId && approverId === authorId) {
    return {
      ok: false,
      error: 'demo_content_self_approval_blocked',
      reason: 'sod_author_must_differ_from_approver',
    };
  }
  return { ok: true, approverId };
}

export function isEditableStatus(status) {
  return EDITABLE.has(String(status || '').trim().toUpperCase());
}

export function isValidVersionStatus(status) {
  return STATUS_SET.has(String(status || '').trim().toUpperCase());
}

/**
 * Customer / invitation surfaces never receive RESTRICTED content.
 */
export function isExternalSurface(surface) {
  const s = String(surface || '').trim().toUpperCase();
  return (
    s === CRM_DEMO_PROJECTION_SURFACE.CUSTOMER ||
    s === CRM_DEMO_PROJECTION_SURFACE.INVITATION
  );
}

export function resolveDemoContentAccess(admin) {
  return resolveCrmAccess(admin);
}

export {
  CRM_DEMO_VERSION_STATUS,
  CRM_DEMO_CONTENT_CLASSIFICATION,
  CRM_DEMO_PROJECTION_SURFACE,
};
