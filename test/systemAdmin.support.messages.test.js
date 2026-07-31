/**
 * Phase 10 Wave 2 — Support messages + customer projection boundary.
 * INTERNAL / RESTRICTED never appear in projectForCustomer.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  SUPPORT_MESSAGE_TYPE,
  addPublicReply,
  addInternalNote,
  addRestrictedNote,
  listMessages,
  projectForCustomer,
  hasSupportMessageModel,
} from '@/lib/admin/support';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

function makePrisma(overrides = {}) {
  const ticketStore = overrides._ticketStore || [
    {
      id: 'st-1',
      ticketNumber: 'SUP-2026-000001',
      tenantId: 'tenant-1',
      status: 'NEW',
      type: 'QUESTION',
      title: 'Help',
      description: 'desc',
      assigneeAdminId: null,
      queueCode: null,
      createdAt: new Date('2026-07-30T12:00:00.000Z'),
      updatedAt: new Date('2026-07-30T12:00:00.000Z'),
    },
  ];
  const messageStore = overrides._messageStore || [];

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
        return ticketStore[0] || null;
      }),
    },
    supportMessage: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `msg-${messageStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          ...data,
        };
        messageStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {}, orderBy } = {}) => {
        let rows = [...messageStore];
        if (where?.ticketId) rows = rows.filter((r) => r.ticketId === where.ticketId);
        if (where?.type?.in) {
          const set = new Set(where.type.in);
          rows = rows.filter((r) => set.has(r.type));
        } else if (where?.type?.notIn) {
          const set = new Set(where.type.notIn);
          rows = rows.filter((r) => !set.has(r.type));
        }
        if (orderBy?.createdAt === 'asc') {
          rows.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }
        return rows;
      }),
    },
    $transaction: vi.fn(async (fn) => fn(prisma)),
  };

  prisma._ticketStore = ticketStore;
  prisma._messageStore = messageStore;
  return prisma;
}

const superAdmin = { id: 'a-super', role: 'Super Admin', permissions: {} };

const agentFull = {
  id: 'admin-agent',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      support: {
        viewTickets: true,
        replyPublicly: true,
        addInternalNotes: true,
        addRestrictedNotes: true,
      },
    },
  },
};

const agentPublicOnly = {
  id: 'admin-public',
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

const viewerOnly = {
  id: 'admin-viewer',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      support: { viewTickets: true },
    },
  },
};

describe('systemAdmin.support.messages', () => {
  it('wires reply / note permissions from SECURITY_MATRIX', () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.support.replyPublicly).toBe(
      'systemAdmin.support.replyPublicly'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.support.addInternalNotes).toBe(
      'systemAdmin.support.addInternalNotes'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.support.addRestrictedNotes).toBe(
      'systemAdmin.support.addRestrictedNotes'
    );
  });

  it('adds public reply and lists it for agents', async () => {
    const prisma = makePrisma();
    expect(hasSupportMessageModel(prisma)).toBe(true);

    const created = await addPublicReply(prisma, {
      admin: agentFull,
      ticketId: 'st-1',
      body: 'We are looking into this.',
    });
    expect(created.ok).toBe(true);
    expect(created.message.type).toBe(SUPPORT_MESSAGE_TYPE.PUBLIC_AGENT_REPLY);
    expect(created.message.body).toBe('We are looking into this.');

    const listed = await listMessages(prisma, { admin: agentFull, ticketId: 'st-1' });
    expect(listed.ok).toBe(true);
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0].type).toBe(SUPPORT_MESSAGE_TYPE.PUBLIC_AGENT_REPLY);
  });

  it('forbids public reply without replyPublicly', async () => {
    const prisma = makePrisma();
    const result = await addPublicReply(prisma, {
      admin: viewerOnly,
      ticketId: 'st-1',
      body: 'Nope',
    });
    expect(result.ok).toBe(false);
    expect(result.forbidden).toBe(true);
    expect(prisma.supportMessage.create).not.toHaveBeenCalled();
  });

  it('adds internal note; viewer without internal perm does not see it in list', async () => {
    const prisma = makePrisma();
    const note = await addInternalNote(prisma, {
      admin: agentFull,
      ticketId: 'st-1',
      body: 'Looks like password reset loop',
    });
    expect(note.ok).toBe(true);
    expect(note.message.type).toBe(SUPPORT_MESSAGE_TYPE.INTERNAL_NOTE);

    const forAgent = await listMessages(prisma, { admin: agentFull, ticketId: 'st-1' });
    expect(forAgent.items.some((m) => m.type === SUPPORT_MESSAGE_TYPE.INTERNAL_NOTE)).toBe(true);

    const forViewer = await listMessages(prisma, { admin: viewerOnly, ticketId: 'st-1' });
    expect(forViewer.ok).toBe(true);
    expect(forViewer.items.some((m) => m.type === SUPPORT_MESSAGE_TYPE.INTERNAL_NOTE)).toBe(false);
  });

  it('adds restricted note only with addRestrictedNotes; public-only agent cannot', async () => {
    const prisma = makePrisma();
    const denied = await addRestrictedNote(prisma, {
      admin: agentPublicOnly,
      ticketId: 'st-1',
      body: 'Security token leak suspected',
    });
    expect(denied.ok).toBe(false);
    expect(denied.forbidden).toBe(true);

    const ok = await addRestrictedNote(prisma, {
      admin: agentFull,
      ticketId: 'st-1',
      body: 'Security token leak suspected',
    });
    expect(ok.ok).toBe(true);
    expect(ok.message.type).toBe(SUPPORT_MESSAGE_TYPE.RESTRICTED_INTERNAL_NOTE);

    const forPublic = await listMessages(prisma, { admin: agentPublicOnly, ticketId: 'st-1' });
    expect(
      forPublic.items.some((m) => m.type === SUPPORT_MESSAGE_TYPE.RESTRICTED_INTERNAL_NOTE)
    ).toBe(false);
  });

  it('projectForCustomer never includes INTERNAL or RESTRICTED notes', async () => {
    const prisma = makePrisma();
    await addPublicReply(prisma, {
      admin: superAdmin,
      ticketId: 'st-1',
      body: 'Public update',
    });
    await addInternalNote(prisma, {
      admin: superAdmin,
      ticketId: 'st-1',
      body: 'Internal only',
    });
    await addRestrictedNote(prisma, {
      admin: superAdmin,
      ticketId: 'st-1',
      body: 'Restricted only',
    });

    // Seed a customer message + system event directly
    await prisma.supportMessage.create({
      data: {
        ticketId: 'st-1',
        type: SUPPORT_MESSAGE_TYPE.CUSTOMER_MESSAGE,
        body: 'Still broken',
        authorAdminId: null,
        visibility: 'CUSTOMER',
      },
    });
    await prisma.supportMessage.create({
      data: {
        ticketId: 'st-1',
        type: SUPPORT_MESSAGE_TYPE.SYSTEM_EVENT,
        body: 'Ticket created',
        authorAdminId: null,
        visibility: 'SYSTEM',
        systemEventCode: 'TICKET_CREATED',
      },
    });

    const all = await listMessages(prisma, { admin: superAdmin, ticketId: 'st-1' });
    const projected = projectForCustomer(all.items);
    const types = projected.map((m) => m.type);

    expect(types).toContain(SUPPORT_MESSAGE_TYPE.PUBLIC_AGENT_REPLY);
    expect(types).toContain(SUPPORT_MESSAGE_TYPE.CUSTOMER_MESSAGE);
    expect(types).not.toContain(SUPPORT_MESSAGE_TYPE.INTERNAL_NOTE);
    expect(types).not.toContain(SUPPORT_MESSAGE_TYPE.RESTRICTED_INTERNAL_NOTE);
    // SYSTEM_EVENT limited — only customer-safe codes (or excluded entirely if not safe)
    for (const m of projected) {
      expect(m.type).not.toBe(SUPPORT_MESSAGE_TYPE.INTERNAL_NOTE);
      expect(m.type).not.toBe(SUPPORT_MESSAGE_TYPE.RESTRICTED_INTERNAL_NOTE);
    }
  });

  it('rejects empty body on message create', async () => {
    const prisma = makePrisma();
    const result = await addPublicReply(prisma, {
      admin: agentFull,
      ticketId: 'st-1',
      body: '   ',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('body_required');
  });
});
