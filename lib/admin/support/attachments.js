/**
 * Support attachments — private storage + scan-state download gate (Phase 10 Wave 2).
 *
 * Storage choice: local private directory under `storage/support-attachments/`
 * (gitignored). Override with SUPPORT_ATTACHMENT_STORAGE_ROOT env.
 * Keys are opaque (`{ticketId}/{uuid}`) — never under `public/uploads`.
 * New uploads default to PENDING_SCAN (fail closed). Only CLEAN + ACL downloadable.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  SUPPORT_ATTACHMENT_STATE,
  SUPPORT_ATTACHMENT_STATES,
  SUPPORT_ALLOWED_MIME_TYPES,
  SUPPORT_ATTACHMENT_MAX_BYTES,
} from './catalogue.js';
import { resolveSupportAccess } from './authz.js';
import { findSupportTicket } from './ticketLookup.js';

const MIME_SET = new Set(SUPPORT_ALLOWED_MIME_TYPES);
const STATE_SET = new Set(SUPPORT_ATTACHMENT_STATES);

function defaultStorageRoot() {
  if (process.env.SUPPORT_ATTACHMENT_STORAGE_ROOT) {
    return path.resolve(process.env.SUPPORT_ATTACHMENT_STORAGE_ROOT);
  }
  return path.resolve(process.cwd(), 'storage', 'support-attachments');
}

/** Resolved at call time so tests can override via env. */
export function getSupportAttachmentStorageRoot() {
  return defaultStorageRoot();
}

/** Documented constant for tests / docs (may lag env override — prefer getter). */
export const SUPPORT_ATTACHMENT_STORAGE_ROOT =
  process.env.SUPPORT_ATTACHMENT_STORAGE_ROOT ||
  path.join('storage', 'support-attachments');

export function hasSupportAttachmentModel(prisma) {
  return typeof prisma?.supportAttachment?.create === 'function';
}

/**
 * Strip CR/LF/quotes/controls and other header-unsafe characters for Content-Disposition.
 * @param {string|null|undefined} fileName
 * @returns {string}
 */
export function sanitizeContentDispositionFileName(fileName) {
  const cleaned = String(fileName || 'download')
    .replace(/[\r\n\0\x08\x1b"\\]/g, '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/[/\\]/g, '_')
    .trim();
  return (cleaned || 'download').slice(0, 200);
}

function serializeAttachment(row) {
  if (!row) return null;
  return {
    id: row.id,
    ticketId: row.ticketId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storageKey: row.storageKey,
    scanState: row.scanState,
    uploadedByAdminId: row.uploadedByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    scannedAt: row.scannedAt ? new Date(row.scannedAt).toISOString() : null,
  };
}

/**
 * @param {object|null} attachment
 * @param {object|null|undefined} admin
 * @returns {boolean}
 */
export function canDownloadAttachment(attachment, admin) {
  if (!attachment) return false;
  if (attachment.scanState !== SUPPORT_ATTACHMENT_STATE.CLEAN) return false;
  const access = resolveSupportAccess(admin);
  return access.canViewTickets;
}

/**
 * Resolve storage key under private root with separator-safe containment.
 * @param {string} storageKey
 * @returns {string}
 */
export function absolutePathForKey(storageKey) {
  const root = path.resolve(getSupportAttachmentStorageRoot());
  const resolved = path.resolve(root, String(storageKey || ''));
  const rel = path.relative(root, resolved);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('invalid_storage_key');
  }
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('invalid_storage_key');
  }
  return resolved;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   ticketId: string,
 *   fileName: string,
 *   mimeType: string,
 *   sizeBytes?: number,
 *   content?: Buffer|Uint8Array|string,
 * }} args
 */
export async function createAttachment(prisma, args = {}) {
  const access = resolveSupportAccess(args.admin);
  if (!access.canViewTickets) {
    return { ok: false, forbidden: true, reason: 'support_view_forbidden' };
  }

  // Uploads require replyPublicly or createTickets (agent acting on ticket)
  if (!access.canReplyPublicly && !access.canCreateTickets && !access.isSuperAdmin) {
    return { ok: false, forbidden: true, reason: 'support_attachment_upload_forbidden' };
  }

  if (!hasSupportAttachmentModel(prisma)) {
    return { ok: false, error: 'support_attachment_model_unavailable', status: 'UNAVAILABLE' };
  }

  const fileName = args.fileName ? String(args.fileName).trim() : '';
  const mimeType = args.mimeType ? String(args.mimeType).trim().toLowerCase() : '';
  if (!fileName) return { ok: false, error: 'fileName_required' };
  if (!MIME_SET.has(mimeType)) {
    return { ok: false, error: 'invalid_mime_type', mimeType };
  }

  const ticket = await findSupportTicket(prisma, args.ticketId);
  if (!ticket) return { ok: false, notFound: true, error: 'ticket_not_found' };

  let content = args.content;
  if (typeof content === 'string') content = Buffer.from(content);
  if (content && !Buffer.isBuffer(content)) content = Buffer.from(content);

  const actualBytes = content ? Buffer.byteLength(content) : 0;
  const declaredBytes =
    typeof args.sizeBytes === 'number' && Number.isFinite(args.sizeBytes)
      ? args.sizeBytes
      : null;

  // Gate on the larger of declared vs actual so a small declared size cannot bypass.
  const gateBytes = Math.max(declaredBytes ?? 0, actualBytes);
  if (gateBytes <= 0) return { ok: false, error: 'sizeBytes_required' };
  if (gateBytes > SUPPORT_ATTACHMENT_MAX_BYTES) {
    return { ok: false, error: 'file_too_large', maxBytes: SUPPORT_ATTACHMENT_MAX_BYTES };
  }

  // Prefer trusting actual length for stored size when bytes were provided.
  const sizeBytes = content ? actualBytes : declaredBytes ?? 0;

  const objectId = crypto.randomUUID();
  const storageKey = path.posix.join(ticket.id, objectId);
  const abs = absolutePathForKey(storageKey);

  await fs.mkdir(path.dirname(abs), { recursive: true });
  if (content) {
    await fs.writeFile(abs, content);
  } else {
    // Metadata-only create still reserves opaque key (empty placeholder)
    await fs.writeFile(abs, Buffer.alloc(0));
  }

  const now = new Date();
  const row = await prisma.supportAttachment.create({
    data: {
      ticketId: ticket.id,
      fileName,
      mimeType,
      sizeBytes,
      storageKey,
      scanState: SUPPORT_ATTACHMENT_STATE.PENDING_SCAN,
      uploadedByAdminId: args.admin?.id || null,
      createdAt: now,
      updatedAt: now,
      scannedAt: null,
    },
  });

  return { ok: true, attachment: serializeAttachment(row) };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, ticketId: string }} args
 */
export async function listAttachments(prisma, args = {}) {
  const access = resolveSupportAccess(args.admin);
  if (!access.canViewTickets) {
    return { ok: false, forbidden: true, reason: 'support_view_forbidden', items: [] };
  }

  if (!hasSupportAttachmentModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'support_attachment_model_unavailable' },
    };
  }

  const ticket = await findSupportTicket(prisma, args.ticketId);
  if (!ticket) return { ok: false, notFound: true, error: 'ticket_not_found', items: [] };

  let rows = [];
  try {
    rows = await prisma.supportAttachment.findMany({
      where: {
        ticketId: ticket.id,
        scanState: { not: SUPPORT_ATTACHMENT_STATE.DELETED },
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch {
    try {
      rows = await prisma.supportAttachment.findMany({
        where: { ticketId: ticket.id },
      });
      rows = (rows || []).filter((r) => r.scanState !== SUPPORT_ATTACHMENT_STATE.DELETED);
    } catch {
      rows = [];
    }
  }

  return {
    ok: true,
    items: (rows || []).map(serializeAttachment),
    meta: { count: (rows || []).length, ticketId: ticket.id },
  };
}

/**
 * Mark scan result (tests / future scanner). Defaults fail closed.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ attachmentId: string, scanState: string, now?: Date }} args
 */
export async function markScanResult(prisma, args = {}) {
  if (!hasSupportAttachmentModel(prisma)) {
    return { ok: false, error: 'support_attachment_model_unavailable', status: 'UNAVAILABLE' };
  }

  const attachmentId = args.attachmentId ? String(args.attachmentId).trim() : '';
  const scanState = String(args.scanState || '').trim().toUpperCase();
  if (!attachmentId) return { ok: false, error: 'attachmentId_required' };
  if (!STATE_SET.has(scanState)) {
    return { ok: false, error: 'invalid_scan_state', scanState };
  }

  const existing = await prisma.supportAttachment.findUnique({ where: { id: attachmentId } });
  if (!existing) return { ok: false, notFound: true, error: 'attachment_not_found' };

  const now = args.now || new Date();
  const updated = await prisma.supportAttachment.update({
    where: { id: attachmentId },
    data: {
      scanState,
      scannedAt: now,
      updatedAt: now,
    },
  });

  return { ok: true, attachment: serializeAttachment(updated) };
}

/**
 * Download gate — CLEAN only + ACL + ticket binding. Returns buffer or absolutePath.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, attachmentId: string, ticketId: string }} args
 */
export async function getAttachmentDownload(prisma, args = {}) {
  const access = resolveSupportAccess(args.admin);
  if (!access.canViewTickets) {
    return { ok: false, forbidden: true, reason: 'support_view_forbidden' };
  }

  if (!hasSupportAttachmentModel(prisma)) {
    return { ok: false, error: 'support_attachment_model_unavailable', status: 'UNAVAILABLE' };
  }

  const attachmentId = args.attachmentId ? String(args.attachmentId).trim() : '';
  if (!attachmentId) return { ok: false, error: 'attachmentId_required' };

  const ticketIdOrNumber = args.ticketId ? String(args.ticketId).trim() : '';
  if (!ticketIdOrNumber) return { ok: false, error: 'ticketId_required' };

  const ticket = await findSupportTicket(prisma, ticketIdOrNumber);
  if (!ticket) return { ok: false, notFound: true, error: 'ticket_not_found' };

  const row = await prisma.supportAttachment.findUnique({ where: { id: attachmentId } });
  if (!row || row.scanState === SUPPORT_ATTACHMENT_STATE.DELETED) {
    return { ok: false, notFound: true, error: 'attachment_not_found' };
  }

  if (row.ticketId !== ticket.id) {
    return { ok: false, notFound: true, error: 'attachment_not_found', reason: 'ticket_mismatch' };
  }

  if (!canDownloadAttachment(row, args.admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'attachment_not_downloadable',
      scanState: row.scanState,
    };
  }

  let absolutePath;
  try {
    absolutePath = absolutePathForKey(row.storageKey);
  } catch {
    return { ok: false, notFound: true, error: 'storage_key_invalid' };
  }

  let buffer = null;
  try {
    buffer = await fs.readFile(absolutePath);
  } catch {
    return { ok: false, notFound: true, error: 'storage_object_missing' };
  }

  return {
    ok: true,
    attachment: serializeAttachment(row),
    buffer,
    absolutePath,
    mimeType: row.mimeType,
    fileName: row.fileName,
  };
}

export { serializeAttachment };
