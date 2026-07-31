/**
 * CRM notes — Phase 11 Wave 4 foundations.
 * INTERNAL / RESTRICTED visibility enforced in service layer (never CSS-only).
 * Restricted projection omits RESTRICTED bodies for viewers without permission.
 */

import {
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
  CRM_NOTE_VISIBILITY,
  CRM_NOTE_VISIBILITIES,
  CRM_SUBJECT_TYPE,
  CRM_SUBJECT_TYPES,
  CRM_TIMELINE_EVENT_TYPE,
} from './catalogue.js';
import { resolveCrmAccess } from './authz.js';
import { appendTimelineEvent } from './timeline.js';

const SUBJECT_SET = new Set(CRM_SUBJECT_TYPES);
const VIS_SET = new Set(CRM_NOTE_VISIBILITIES);

export function hasCrmNoteModel(prisma) {
  return typeof prisma?.crmNote?.findMany === 'function';
}

function serializeNote(row, { redactRestricted = false } = {}) {
  if (!row) return null;
  const restricted = row.visibility === CRM_NOTE_VISIBILITY.RESTRICTED;
  if (redactRestricted && restricted) {
    return {
      id: row.id,
      activityId: row.activityId || null,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      visibility: row.visibility,
      body: null,
      redacted: true,
      authorAdminId: row.authorAdminId || null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    };
  }
  return {
    id: row.id,
    activityId: row.activityId || null,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    visibility: row.visibility,
    body: row.body,
    redacted: false,
    authorAdminId: row.authorAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/**
 * Fail-closed projection: drop or redact RESTRICTED notes for unprivileged viewers.
 *
 * @param {Array<object>} notes
 * @param {{ canViewRestricted?: boolean, mode?: 'omit'|'redact' }} opts
 */
export function projectNotesForViewer(notes, opts = {}) {
  const list = Array.isArray(notes) ? notes : [];
  const canView = Boolean(opts.canViewRestricted);
  const mode = opts.mode === 'redact' ? 'redact' : 'omit';
  return list
    .filter((n) => {
      if (String(n?.visibility) !== CRM_NOTE_VISIBILITY.RESTRICTED) return true;
      return canView || mode === 'redact';
    })
    .map((n) => {
      if (
        String(n?.visibility) === CRM_NOTE_VISIBILITY.RESTRICTED &&
        !canView
      ) {
        return serializeNote(n, { redactRestricted: true });
      }
      return serializeNote(n);
    });
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   subjectType?: string,
 *   subjectId: string,
 *   body: string,
 *   visibility?: string,
 *   activityId?: string|null,
 *   now?: Date,
 * }} args
 */
export async function createNote(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  const visibility = String(args.visibility || CRM_NOTE_VISIBILITY.INTERNAL)
    .trim()
    .toUpperCase();

  if (!VIS_SET.has(visibility)) {
    return { ok: false, error: 'invalid_visibility' };
  }
  if (visibility === CRM_NOTE_VISIBILITY.RESTRICTED) {
    if (!access.canAddRestrictedNotes) {
      return { ok: false, forbidden: true, reason: 'crm_restricted_note_forbidden' };
    }
  } else if (!access.canAddInternalNotes) {
    return { ok: false, forbidden: true, reason: 'crm_internal_note_forbidden' };
  }

  const subjectType = String(args.subjectType || CRM_SUBJECT_TYPE.LEAD)
    .trim()
    .toUpperCase();
  const subjectId = args.subjectId ? String(args.subjectId).trim() : '';
  const body = args.body != null ? String(args.body).trim() : '';
  if (!SUBJECT_SET.has(subjectType) || !subjectId) {
    return { ok: false, error: 'subjectType_and_subjectId_required' };
  }
  if (!body) return { ok: false, error: 'body_required' };

  if (!hasCrmNoteModel(prisma)) {
    return { ok: false, error: 'crm_note_model_unavailable', status: 'UNAVAILABLE' };
  }

  const activityId = args.activityId ? String(args.activityId).trim() : null;
  const now = args.now || new Date();
  const row = await prisma.crmNote.create({
    data: {
      subjectType,
      subjectId,
      body,
      visibility,
      activityId: activityId || undefined,
      authorAdminId: args.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType,
    subjectId,
    eventType: CRM_TIMELINE_EVENT_TYPE.NOTE_ADDED,
    summary: `Note added (${visibility})`,
    payload: { noteId: row.id, visibility, activityId: activityId || null },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return { ok: true, note: serializeNote(row) };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   subjectType?: string,
 *   subjectId: string,
 *   limit?: number|string,
 *   offset?: number|string,
 * }} args
 */
export async function listNotes(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewLeads &&
    !access.canViewAccounts &&
    !access.canViewContacts &&
    !access.canViewOpportunities &&
    !access.canViewActivities
  ) {
    return { ok: false, forbidden: true, reason: 'crm_view_forbidden', items: [] };
  }

  const subjectType = String(args.subjectType || CRM_SUBJECT_TYPE.LEAD)
    .trim()
    .toUpperCase();
  const subjectId = args.subjectId ? String(args.subjectId).trim() : '';
  if (!SUBJECT_SET.has(subjectType) || !subjectId) {
    return { ok: false, error: 'subjectType_and_subjectId_required', items: [] };
  }

  if (!hasCrmNoteModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'crm_note_model_unavailable', count: 0 },
    };
  }

  const rawLimit = Number(args.limit);
  const limit = Math.min(
    CRM_LIST_MAX_LIMIT,
    Math.max(1, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : CRM_LIST_DEFAULT_LIMIT)
  );
  const rawOffset = Number(args.offset);
  const offset =
    Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  let rows = [];
  try {
    rows = await prisma.crmNote.findMany({
      where: { subjectType, subjectId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset > 0 ? offset : undefined,
    });
  } catch {
    rows = [];
  }

  const projected = projectNotesForViewer(rows, {
    canViewRestricted: access.canViewRestrictedNotes,
    mode: 'omit',
  });

  return {
    ok: true,
    items: projected,
    meta: {
      count: projected.length,
      limit,
      offset,
      restrictedOmitted: !access.canViewRestrictedNotes,
    },
  };
}

export { serializeNote, CRM_NOTE_VISIBILITY };
