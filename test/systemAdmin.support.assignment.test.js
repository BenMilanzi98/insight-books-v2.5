/**
 * Phase 10 Wave 2 — Queues / teams stubs + ticket assignment history.
 * Same assignee+queue → noop; no silent reassign loops.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  SUPPORT_QUEUE_CODES,
  SUPPORT_TICKET_STATUS,
  listQueues,
  seedQueueCatalogue,
  listTeams,
  assignTicket,
  hasSupportAssignmentHistoryModel,
  canTransition,
} from '@/lib/admin/support';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

function makePrisma(overrides = {}) {
  const ticketStore = overrides._ticketStore || [
    {
      id: 'st-1',
      ticketNumber: 'SUP-2026-000001',
      tenantId: 'tenant-1',
      status: SUPPORT_TICKET_STATUS.TRIAGE,
      type: 'QUESTION',
      title: 'Help',
      description: 'desc',
      assigneeAdminId: null,
      queueCode: null,
      resolutionCategory: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      resolvedAt: null,
      closedAt: null,
    },
  ];
  const historyStore = overrides._historyStore || [];
  const statusHistoryStore = overrides._statusHistoryStore || [];
  const queueStore = overrides._queueStore || [];
  const teamStore = overrides._teamStore || [];
  const membershipStore = overrides._membershipStore || [];

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
      update: vi.fn(async ({ where, data }) => {
        const row = ticketStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
    },
    supportTicketStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `sth-${statusHistoryStore.length + 1}`, at: data.at || new Date(), ...data };
        statusHistoryStore.push(row);
        return row;
      }),
    },
    supportAssignmentHistory: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: `sah-${historyStore.length + 1}`,
          at: data.at || new Date(),
          ...data,
        };
        historyStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...historyStore];
        if (where?.ticketId) rows = rows.filter((r) => r.ticketId === where.ticketId);
        return rows;
      }),
    },
    supportQueue: {
      findMany: vi.fn(async () => [...queueStore]),
      upsert: vi.fn(async ({ where, create, update }) => {
        let row = queueStore.find((r) => r.code === where.code);
        if (!row) {
          row = { id: `q-${queueStore.length + 1}`, ...create };
          queueStore.push(row);
        } else {
          Object.assign(row, update || {});
        }
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return queueStore.find((r) => r.code === where.code) || null;
      }),
    },
    supportTeam: {
      findMany: vi.fn(async () => [...teamStore]),
    },
    supportTeamMembership: {
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...membershipStore];
        if (where?.adminId) rows = rows.filter((r) => r.adminId === where.adminId);
        if (where?.teamCode) rows = rows.filter((r) => r.teamCode === where.teamCode);
        return rows;
      }),
    },
    $transaction: vi.fn(async (fn) => fn(prisma)),
  };

  prisma._ticketStore = ticketStore;
  prisma._historyStore = historyStore;
  prisma._statusHistoryStore = statusHistoryStore;
  prisma._queueStore = queueStore;
  prisma._teamStore = teamStore;
  prisma._membershipStore = membershipStore;
  return prisma;
}

const assigner = {
  id: 'admin-assigner',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      support: {
        viewTickets: true,
        assignTickets: true,
        transitionStatus: true,
      },
    },
  },
};

const viewer = {
  id: 'admin-viewer',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      support: { viewTickets: true },
    },
  },
};

describe('systemAdmin.support.assignment', () => {
  it('wires assignTickets permission', () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.support.assignTickets).toBe(
      'systemAdmin.support.assignTickets'
    );
  });

  it('exposes QUEUE_TEAM_MATRIX seed codes as definitions (not live ops metrics)', () => {
    const expected = [
      'GENERAL_SUPPORT',
      'ACCOUNT_ACCESS',
      'BILLING',
      'MRA_EIS',
      'PRODUCT',
      'TECHNICAL',
      'ANDROID',
      'SECURITY',
      'ESCALATIONS',
    ];
    expect(SUPPORT_QUEUE_CODES).toEqual(expected);

    const listed = listQueues();
    expect(listed.ok).toBe(true);
    expect(listed.items.map((q) => q.code)).toEqual(expected);
    for (const q of listed.items) {
      expect(q.liveStatus).toBe('NOT_FOUND');
      expect(q).not.toHaveProperty('openTicketCount');
      expect(q).not.toHaveProperty('staffing');
    }
  });

  it('seeds queue catalogue into SupportQueue without inventing live staffing', async () => {
    const prisma = makePrisma();
    const seeded = await seedQueueCatalogue(prisma);
    expect(seeded.ok).toBe(true);
    expect(seeded.count).toBe(SUPPORT_QUEUE_CODES.length);
    expect(prisma.supportQueue.upsert).toHaveBeenCalled();

    const fromDb = await listQueues(prisma);
    expect(fromDb.items.every((q) => q.liveStatus === 'NOT_FOUND')).toBe(true);
  });

  it('lists team stubs for assignment eligibility', () => {
    const teams = listTeams();
    expect(teams.ok).toBe(true);
    expect(teams.items.length).toBeGreaterThan(0);
    expect(teams.items[0]).toHaveProperty('code');
    expect(teams.stub).toBe(true);
  });

  it('assigns ticket, appends assignment history, and may move TRIAGE→ASSIGNED via state machine', async () => {
    const prisma = makePrisma();
    expect(hasSupportAssignmentHistoryModel(prisma)).toBe(true);
    expect(canTransition(SUPPORT_TICKET_STATUS.TRIAGE, SUPPORT_TICKET_STATUS.ASSIGNED)).toBe(true);

    const result = await assignTicket(prisma, {
      admin: assigner,
      ticketId: 'st-1',
      assigneeAdminId: 'admin-agent-2',
      queueCode: 'GENERAL_SUPPORT',
      reason: 'Initial ownership',
    });

    expect(result.ok).toBe(true);
    expect(result.noop).not.toBe(true);
    expect(result.ticket.assigneeAdminId).toBe('admin-agent-2');
    expect(result.ticket.queueCode).toBe('GENERAL_SUPPORT');
    expect(result.ticket.status).toBe(SUPPORT_TICKET_STATUS.ASSIGNED);
    expect(prisma._historyStore).toHaveLength(1);
    expect(prisma._historyStore[0].toAssigneeAdminId).toBe('admin-agent-2');
    expect(prisma._historyStore[0].toQueueCode).toBe('GENERAL_SUPPORT');
  });

  it('same assignee + same queue is a noop with no duplicate history', async () => {
    const prisma = makePrisma();
    await assignTicket(prisma, {
      admin: assigner,
      ticketId: 'st-1',
      assigneeAdminId: 'admin-agent-2',
      queueCode: 'BILLING',
    });
    expect(prisma._historyStore).toHaveLength(1);

    const again = await assignTicket(prisma, {
      admin: assigner,
      ticketId: 'st-1',
      assigneeAdminId: 'admin-agent-2',
      queueCode: 'BILLING',
      reason: 'retry',
    });
    expect(again.ok).toBe(true);
    expect(again.noop).toBe(true);
    expect(prisma._historyStore).toHaveLength(1);
  });

  it('reassign appends history (reason optional)', async () => {
    const prisma = makePrisma();
    await assignTicket(prisma, {
      admin: assigner,
      ticketId: 'st-1',
      assigneeAdminId: 'admin-a',
      queueCode: 'TECHNICAL',
    });
    const re = await assignTicket(prisma, {
      admin: assigner,
      ticketId: 'st-1',
      assigneeAdminId: 'admin-b',
      queueCode: 'TECHNICAL',
    });
    expect(re.ok).toBe(true);
    expect(re.noop).not.toBe(true);
    expect(prisma._historyStore).toHaveLength(2);
    expect(prisma._historyStore[1].fromAssigneeAdminId).toBe('admin-a');
    expect(prisma._historyStore[1].toAssigneeAdminId).toBe('admin-b');
  });

  it('forbids assign without assignTickets', async () => {
    const prisma = makePrisma();
    const result = await assignTicket(prisma, {
      admin: viewer,
      ticketId: 'st-1',
      assigneeAdminId: 'admin-x',
      queueCode: 'GENERAL_SUPPORT',
    });
    expect(result.ok).toBe(false);
    expect(result.forbidden).toBe(true);
    expect(prisma.supportTicket.update).not.toHaveBeenCalled();
  });

  it('does not bypass state machine when NEW cannot go directly to ASSIGNED', async () => {
    const prisma = makePrisma({
      _ticketStore: [
        {
          id: 'st-new',
          ticketNumber: 'SUP-2026-000099',
          tenantId: 'tenant-1',
          status: SUPPORT_TICKET_STATUS.NEW,
          type: 'QUESTION',
          title: 'New',
          description: 'd',
          assigneeAdminId: null,
          queueCode: null,
          resolutionCategory: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          resolvedAt: null,
          closedAt: null,
        },
      ],
    });

    expect(canTransition(SUPPORT_TICKET_STATUS.NEW, SUPPORT_TICKET_STATUS.ASSIGNED)).toBe(false);

    const result = await assignTicket(prisma, {
      admin: assigner,
      ticketId: 'st-new',
      assigneeAdminId: 'admin-agent-2',
      queueCode: 'GENERAL_SUPPORT',
    });
    expect(result.ok).toBe(true);
    expect(result.ticket.assigneeAdminId).toBe('admin-agent-2');
    // Status stays NEW — assignment recorded without illegal transition
    expect(result.ticket.status).toBe(SUPPORT_TICKET_STATUS.NEW);
    expect(prisma._statusHistoryStore.filter((h) => h.toStatus === 'ASSIGNED')).toHaveLength(0);
  });

  it('rejects unknown queue codes', async () => {
    const prisma = makePrisma();
    const result = await assignTicket(prisma, {
      admin: assigner,
      ticketId: 'st-1',
      assigneeAdminId: 'admin-x',
      queueCode: 'FAKE_QUEUE',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('invalid_queue_code');
  });
});
