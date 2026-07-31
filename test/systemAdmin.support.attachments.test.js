/**
 * Phase 10 Wave 2 — Support attachments boundary (scan states + private storage).
 * PENDING_SCAN / non-CLEAN are not downloadable.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  SUPPORT_ATTACHMENT_STATE,
  SUPPORT_ATTACHMENT_MAX_BYTES,
  createAttachment,
  listAttachments,
  getAttachmentDownload,
  markScanResult,
  canDownloadAttachment,
  hasSupportAttachmentModel,
  SUPPORT_ATTACHMENT_STORAGE_ROOT,
  absolutePathForKey,
  sanitizeContentDispositionFileName,
} from '@/lib/admin/support';

function makePrisma(overrides = {}) {
  const ticketStore = overrides._ticketStore || [
    {
      id: 'st-1',
      ticketNumber: 'SUP-2026-000001',
      tenantId: 'tenant-1',
      status: 'IN_PROGRESS',
      type: 'QUESTION',
      title: 'Help',
      description: 'desc',
    },
    {
      id: 'st-2',
      ticketNumber: 'SUP-2026-000002',
      tenantId: 'tenant-1',
      status: 'IN_PROGRESS',
      type: 'QUESTION',
      title: 'Other',
      description: 'other',
    },
  ];
  const attachmentStore = overrides._attachmentStore || [];

  const prisma = {
    supportTicket: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return ticketStore.find((r) => r.id === where.id) || null;
        if (where.ticketNumber) {
          return ticketStore.find((r) => r.ticketNumber === where.ticketNumber) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        if (where?.OR) {
          return (
            ticketStore.find((r) =>
              where.OR.some(
                (c) => (c.id && r.id === c.id) || (c.ticketNumber && r.ticketNumber === c.ticketNumber)
              )
            ) || null
          );
        }
        return null;
      }),
    },
    supportAttachment: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `att-${attachmentStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        attachmentStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return attachmentStore.find((r) => r.id === where.id) || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...attachmentStore];
        if (where?.ticketId) rows = rows.filter((r) => r.ticketId === where.ticketId);
        if (where?.scanState?.not) {
          rows = rows.filter((r) => r.scanState !== where.scanState.not);
        }
        return rows;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = attachmentStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
    },
  };

  prisma._ticketStore = ticketStore;
  prisma._attachmentStore = attachmentStore;
  return prisma;
}

const agent = {
  id: 'admin-agent',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      support: {
        viewTickets: true,
        replyPublicly: true,
      },
    },
  },
};

const noPerms = {
  id: 'admin-none',
  role: 'Platform Support',
  permissions: { systemAdmin: {} },
};

describe('systemAdmin.support.attachments', () => {
  let tmpRoot;
  let prevRoot;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'support-att-'));
    prevRoot = process.env.SUPPORT_ATTACHMENT_STORAGE_ROOT;
    process.env.SUPPORT_ATTACHMENT_STORAGE_ROOT = tmpRoot;
  });

  afterEach(async () => {
    if (prevRoot === undefined) delete process.env.SUPPORT_ATTACHMENT_STORAGE_ROOT;
    else process.env.SUPPORT_ATTACHMENT_STORAGE_ROOT = prevRoot;
    try {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('uses private storage root (not public/uploads)', () => {
    expect(SUPPORT_ATTACHMENT_STORAGE_ROOT).not.toMatch(/public[/\\]uploads/);
    expect(String(SUPPORT_ATTACHMENT_STORAGE_ROOT)).toMatch(/support-attachments|SUPPORT_ATTACHMENT/);
  });

  it('creates attachment as PENDING_SCAN with opaque storage key', async () => {
    const prisma = makePrisma();
    expect(hasSupportAttachmentModel(prisma)).toBe(true);

    const result = await createAttachment(prisma, {
      admin: agent,
      ticketId: 'st-1',
      fileName: 'screenshot.png',
      mimeType: 'image/png',
      sizeBytes: 12,
      content: Buffer.from('fake-png-bytes'),
    });

    expect(result.ok).toBe(true);
    expect(result.attachment.scanState).toBe(SUPPORT_ATTACHMENT_STATE.PENDING_SCAN);
    expect(result.attachment.storageKey).toBeTruthy();
    expect(result.attachment.storageKey).not.toMatch(/^public\//);
    expect(result.attachment.fileName).toBe('screenshot.png');
    expect(result.attachment.mimeType).toBe('image/png');
  });

  it('rejects invalid MIME types server-side', async () => {
    const prisma = makePrisma();
    const result = await createAttachment(prisma, {
      admin: agent,
      ticketId: 'st-1',
      fileName: 'evil.exe',
      mimeType: 'application/x-msdownload',
      sizeBytes: 4,
      content: Buffer.from('MZ'),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('invalid_mime_type');
    expect(prisma.supportAttachment.create).not.toHaveBeenCalled();
  });

  it('PENDING_SCAN and other non-CLEAN states are not downloadable', async () => {
    const prisma = makePrisma();
    const created = await createAttachment(prisma, {
      admin: agent,
      ticketId: 'st-1',
      fileName: 'doc.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 8,
      content: Buffer.from('%PDF-fake'),
    });
    expect(created.ok).toBe(true);
    const id = created.attachment.id;

    expect(canDownloadAttachment(created.attachment, agent)).toBe(false);

    const pendingDl = await getAttachmentDownload(prisma, {
      admin: agent,
      ticketId: 'st-1',
      attachmentId: id,
    });
    expect(pendingDl.ok).toBe(false);
    expect(pendingDl.forbidden || pendingDl.notFound).toBe(true);

    for (const state of [
      SUPPORT_ATTACHMENT_STATE.QUARANTINED,
      SUPPORT_ATTACHMENT_STATE.INFECTED,
      SUPPORT_ATTACHMENT_STATE.SCAN_FAILED,
      SUPPORT_ATTACHMENT_STATE.REJECTED,
      SUPPORT_ATTACHMENT_STATE.DELETED,
      SUPPORT_ATTACHMENT_STATE.UPLOADED,
    ]) {
      await markScanResult(prisma, { attachmentId: id, scanState: state });
      const row = prisma._attachmentStore.find((a) => a.id === id);
      expect(canDownloadAttachment(row, agent)).toBe(false);
      const dl = await getAttachmentDownload(prisma, {
        admin: agent,
        ticketId: 'st-1',
        attachmentId: id,
      });
      expect(dl.ok).toBe(false);
    }
  });

  it('CLEAN attachments downloadable only with ACL (viewTickets)', async () => {
    const prisma = makePrisma();
    const created = await createAttachment(prisma, {
      admin: agent,
      ticketId: 'st-1',
      fileName: 'ok.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 8,
      content: Buffer.from('%PDF-okok'),
    });
    const id = created.attachment.id;

    const marked = await markScanResult(prisma, {
      attachmentId: id,
      scanState: SUPPORT_ATTACHMENT_STATE.CLEAN,
    });
    expect(marked.ok).toBe(true);
    expect(marked.attachment.scanState).toBe(SUPPORT_ATTACHMENT_STATE.CLEAN);

    expect(canDownloadAttachment(marked.attachment, agent)).toBe(true);
    const dl = await getAttachmentDownload(prisma, {
      admin: agent,
      ticketId: 'st-1',
      attachmentId: id,
    });
    expect(dl.ok).toBe(true);
    expect(dl.buffer || dl.stream || dl.absolutePath).toBeTruthy();

    const denied = await getAttachmentDownload(prisma, {
      admin: noPerms,
      ticketId: 'st-1',
      attachmentId: id,
    });
    expect(denied.ok).toBe(false);
    expect(denied.forbidden).toBe(true);
  });

  it('rejects upload when actual content exceeds max even if declared sizeBytes is small', async () => {
    const prisma = makePrisma();
    const oversized = Buffer.alloc(SUPPORT_ATTACHMENT_MAX_BYTES + 64, 0x41);
    const result = await createAttachment(prisma, {
      admin: agent,
      ticketId: 'st-1',
      fileName: 'big.bin',
      mimeType: 'application/pdf',
      sizeBytes: 12,
      content: oversized,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('file_too_large');
    expect(prisma.supportAttachment.create).not.toHaveBeenCalled();
  });

  it('stores actual content byte length rather than declared sizeBytes', async () => {
    const prisma = makePrisma();
    const content = Buffer.from('actual-payload-bytes');
    const result = await createAttachment(prisma, {
      admin: agent,
      ticketId: 'st-1',
      fileName: 'note.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4,
      content,
    });
    expect(result.ok).toBe(true);
    expect(result.attachment.sizeBytes).toBe(Buffer.byteLength(content));
  });

  it('rejects download when attachment ticket does not match path ticket id/number', async () => {
    const prisma = makePrisma();
    const created = await createAttachment(prisma, {
      admin: agent,
      ticketId: 'st-1',
      fileName: 'bound.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('%PDF-bound'),
    });
    const id = created.attachment.id;
    await markScanResult(prisma, {
      attachmentId: id,
      scanState: SUPPORT_ATTACHMENT_STATE.CLEAN,
    });

    const mismatch = await getAttachmentDownload(prisma, {
      admin: agent,
      ticketId: 'st-2',
      attachmentId: id,
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.notFound || mismatch.forbidden).toBe(true);

    const byNumberOk = await getAttachmentDownload(prisma, {
      admin: agent,
      ticketId: 'SUP-2026-000001',
      attachmentId: id,
    });
    expect(byNumberOk.ok).toBe(true);

    const missingTicket = await getAttachmentDownload(prisma, {
      admin: agent,
      attachmentId: id,
    });
    expect(missingTicket.ok).toBe(false);
    expect(missingTicket.error).toBe('ticketId_required');
  });

  it('absolutePathForKey rejects sibling-prefix escape outside storage root', () => {
    const root = path.resolve(tmpRoot);
    const sibling = `${root}-evil`;
    expect(() => absolutePathForKey(path.join('..', path.basename(sibling), 'x.bin'))).toThrow(
      /invalid_storage_key/
    );
    const safe = absolutePathForKey(path.posix.join('st-1', 'obj-1'));
    expect(safe.startsWith(root + path.sep)).toBe(true);
  });

  it('sanitizeContentDispositionFileName strips CR/LF/quotes and controls', () => {
    const dirty = 'evil\r\nfilename="x.pdf"\x00';
    const safe = sanitizeContentDispositionFileName(dirty);
    expect(safe).not.toMatch(/[\r\n"]/);
    expect(safe).not.toContain('\0');
    expect(safe.length).toBeGreaterThan(0);
  });

  it('lists attachments for ticket viewers (metadata only; no raw path leak of public/uploads)', async () => {
    const prisma = makePrisma();
    await createAttachment(prisma, {
      admin: agent,
      ticketId: 'st-1',
      fileName: 'a.png',
      mimeType: 'image/png',
      sizeBytes: 4,
      content: Buffer.from('img'),
    });
    const listed = await listAttachments(prisma, { admin: agent, ticketId: 'st-1' });
    expect(listed.ok).toBe(true);
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0].storageKey).toBeTruthy();
    expect(JSON.stringify(listed.items[0])).not.toMatch(/public[/\\]uploads/);
  });
});
