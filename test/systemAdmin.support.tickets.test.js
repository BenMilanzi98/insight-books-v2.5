/**
 * Phase 10 Wave 1 — Support tickets (≠ CsCase ≠ PlatformSupportAccess).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  SUPPORT_TICKET_STATUS,
  SUPPORT_SOURCE_CHANNEL,
  channelAvailability,
  defaultPriority,
  canTransition,
  assertTransition,
  allocateTicketNumber,
  createTicket,
  listTickets,
  getTicket,
  transitionTicketStatus,
  hasSupportTicketModel,
  SUPPORT_TICKET_NUMBER_RE,
} from '@/lib/admin/support';
import { SYSTEM_ADMIN_PERMISSIONS, NAV_PERMISSION_MAP } from '@/lib/admin/permissions';

function makePrisma(overrides = {}) {
  const ticketStore = overrides._ticketStore || [];
  const historyStore = overrides._historyStore || [];
  const seqStore = overrides._seqStore || [];
  const caseStore = overrides._caseStore || [];

  const prisma = {
    supportTicket: {
      findMany: vi.fn(async ({ where = {}, take, skip, cursor, orderBy } = {}) => {
        let rows = [...ticketStore];
        if (where?.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        if (where?.status?.in) {
          const set = new Set(where.status.in);
          rows = rows.filter((r) => set.has(r.status));
        } else if (where?.status) {
          rows = rows.filter((r) => r.status === where.status);
        }
        if (where?.id) rows = rows.filter((r) => r.id === where.id);
        if (where?.ticketNumber) {
          rows = rows.filter((r) => r.ticketNumber === where.ticketNumber);
        }
        if (orderBy?.createdAt === 'desc') {
          rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        let start = 0;
        if (cursor?.id) {
          const idx = rows.findIndex((r) => r.id === cursor.id);
          start = idx >= 0 ? idx + 1 : 0;
        }
        if (typeof skip === 'number') start += skip;
        const limit = typeof take === 'number' ? take : rows.length;
        return rows.slice(start, start + limit);
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return ticketStore.find((r) => r.id === where.id) || null;
        if (where.ticketNumber) {
          return ticketStore.find((r) => r.ticketNumber === where.ticketNumber) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...ticketStore];
        if (where?.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.id) return r.id === clause.id;
              if (clause.ticketNumber) return r.ticketNumber === clause.ticketNumber;
              return false;
            })
          );
        }
        if (where?.id) rows = rows.filter((r) => r.id === where.id);
        if (where?.ticketNumber) {
          rows = rows.filter((r) => r.ticketNumber === where.ticketNumber);
        }
        return rows[0] || null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `st-${ticketStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          resolvedAt: data.resolvedAt || null,
          closedAt: data.closedAt || null,
          ...data,
        };
        ticketStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = ticketStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
      count: vi.fn(async () => ticketStore.length),
    },
    supportTicketStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: `sth-${historyStore.length + 1}`,
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
    supportTicketNumberSeq: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return seqStore.find((r) => r.year === where.year) || null;
      }),
      create: vi.fn(async ({ data }) => {
        const existing = seqStore.find((r) => r.year === data.year);
        if (existing) {
          const err = new Error('Unique constraint');
          err.code = 'P2002';
          throw err;
        }
        const row = { ...data, updatedAt: new Date() };
        seqStore.push(row);
        return row;
      }),
      updateMany: vi.fn(async ({ where = {}, data } = {}) => {
        const row = seqStore.find(
          (r) =>
            r.year === where.year &&
            (where.lastIssued === undefined || r.lastIssued === where.lastIssued)
        );
        if (!row) return { count: 0 };
        Object.assign(row, data, { updatedAt: new Date() });
        return { count: 1 };
      }),
    },
    csCase: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `case-${caseStore.length + 1}`, ...data };
        caseStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...caseStore]),
      count: vi.fn(async () => caseStore.length),
    },
    $transaction: vi.fn(async (fn) => fn(prisma)),
  };

  prisma._ticketStore = ticketStore;
  prisma._historyStore = historyStore;
  prisma._seqStore = seqStore;
  prisma._caseStore = caseStore;
  return prisma;
}

const superAdmin = { id: 'a-super', role: 'Super Admin', permissions: {} };

const supportAgent = {
  id: 'admin-support-1',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      support: {
        viewTickets: true,
        createTickets: true,
        transitionStatus: true,
      },
    },
  },
};

const supportViewer = {
  id: 'admin-support-viewer',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      support: { viewTickets: true },
    },
  },
};

const noPerms = {
  id: 'admin-none',
  role: 'Platform Support',
  permissions: { systemAdmin: {} },
};

describe('systemAdmin.support.tickets', () => {
  it('defines support permissions and nav map for /insightbooks/support', () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.support.viewTickets).toBe(
      'systemAdmin.support.viewTickets'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.support.createTickets).toBe(
      'systemAdmin.support.createTickets'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.support.transitionStatus).toBe(
      'systemAdmin.support.transitionStatus'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.support.replyPublicly).toBe(
      'systemAdmin.support.replyPublicly'
    );
    expect(NAV_PERMISSION_MAP['/insightbooks/support']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.support.viewTickets
    );
    expect(NAV_PERMISSION_MAP['/insightbooks/support/tickets']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.support.viewTickets
    );
  });

  it('marks EMAIL / WHATSAPP / PORTAL channels as NOT_AVAILABLE', () => {
    expect(channelAvailability(SUPPORT_SOURCE_CHANNEL.ADMIN_MANUAL)).toBe('AVAILABLE');
    expect(channelAvailability(SUPPORT_SOURCE_CHANNEL.EMAIL)).toBe('NOT_AVAILABLE');
    expect(channelAvailability(SUPPORT_SOURCE_CHANNEL.WHATSAPP)).toBe('NOT_AVAILABLE');
    expect(channelAvailability(SUPPORT_SOURCE_CHANNEL.PORTAL)).toBe('NOT_AVAILABLE');
  });

  it('derives default priority from impact×urgency matrix', () => {
    expect(defaultPriority('PLATFORM_WIDE', 'IMMEDIATE')).toBe('P1');
    expect(defaultPriority('SINGLE_USER', 'LOW')).toBe('P4');
    expect(defaultPriority('UNKNOWN', 'NORMAL')).toBe('P4');
  });

  it('allocates unique SUP-YYYY-###### numbers across sequential creates', async () => {
    const prisma = makePrisma();
    const now = new Date('2026-07-30T12:00:00.000Z');
    const a = await allocateTicketNumber(prisma, { now });
    const b = await allocateTicketNumber(prisma, { now });
    const c = await allocateTicketNumber(prisma, { now });

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(c.ok).toBe(true);
    expect(a.ticketNumber).toMatch(SUPPORT_TICKET_NUMBER_RE);
    expect(a.ticketNumber).toMatch(/^SUP-2026-\d{6}$/);
    expect(new Set([a.ticketNumber, b.ticketNumber, c.ticketNumber]).size).toBe(3);
    expect(a.ticketNumber).toBe('SUP-2026-000001');
    expect(b.ticketNumber).toBe('SUP-2026-000002');
    expect(c.ticketNumber).toBe('SUP-2026-000003');
  });

  it('creates ticket as NEW and does not create CsCase rows', async () => {
    const prisma = makePrisma();
    expect(hasSupportTicketModel(prisma)).toBe(true);

    const result = await createTicket(prisma, {
      admin: supportAgent,
      tenantId: 'tenant-1',
      title: 'Cannot login',
      description: 'User locked out after password reset',
      type: 'ACCOUNT_ACCESS',
      impact: 'SINGLE_USER',
      urgency: 'HIGH',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    expect(result.ticket.status).toBe(SUPPORT_TICKET_STATUS.NEW);
    expect(result.ticket.ticketNumber).toMatch(/^SUP-2026-\d{6}$/);
    expect(result.ticket.sourceChannel).toBe(SUPPORT_SOURCE_CHANNEL.ADMIN_MANUAL);
    expect(prisma.supportTicket.create).toHaveBeenCalled();
    expect(prisma.csCase.create).not.toHaveBeenCalled();
    expect(prisma._caseStore.length).toBe(0);
    expect(prisma._historyStore.length).toBeGreaterThanOrEqual(1);
    expect(prisma._historyStore[0].toStatus).toBe(SUPPORT_TICKET_STATUS.NEW);
  });

  it('rejects unknown impact/urgency/priority/severity on create', async () => {
    const prisma = makePrisma();
    const base = {
      admin: supportAgent,
      tenantId: 'tenant-1',
      title: 'Enum check',
      description: 'desc',
      type: 'QUESTION',
      now: new Date('2026-07-30T12:00:00.000Z'),
    };

    const badImpact = await createTicket(prisma, { ...base, impact: 'GALACTIC' });
    expect(badImpact.ok).toBe(false);
    expect(badImpact.error).toBe('invalid_impact');

    const badUrgency = await createTicket(prisma, { ...base, urgency: 'YESTERDAY' });
    expect(badUrgency.ok).toBe(false);
    expect(badUrgency.error).toBe('invalid_urgency');

    const badPriority = await createTicket(prisma, { ...base, priority: 'P99' });
    expect(badPriority.ok).toBe(false);
    expect(badPriority.error).toBe('invalid_priority');

    const badSeverity = await createTicket(prisma, { ...base, severity: 'APOCALYPTIC' });
    expect(badSeverity.ok).toBe(false);
    expect(badSeverity.error).toBe('invalid_severity');

    const badType = await createTicket(prisma, { ...base, type: 'NOT_A_TYPE' });
    expect(badType.ok).toBe(false);
    expect(badType.error).toBe('invalid_ticket_type');

    expect(prisma.supportTicket.create).not.toHaveBeenCalled();
  });

  it('rejects invalid transitions and accepts happy path to CLOSED', async () => {
    const prisma = makePrisma();
    const created = await createTicket(prisma, {
      admin: supportAgent,
      tenantId: 'tenant-1',
      title: 'Billing glitch',
      description: 'Invoice PDF blank',
      type: 'BILLING_INVOICE',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(created.ok).toBe(true);
    const id = created.ticket.id;

    const bad = await transitionTicketStatus(prisma, {
      admin: supportAgent,
      ticketId: id,
      toStatus: SUPPORT_TICKET_STATUS.CLOSED,
    });
    expect(bad.ok).toBe(false);
    expect(bad.error).toBe('INVALID_TRANSITION');

    const path = [
      SUPPORT_TICKET_STATUS.ACKNOWLEDGED,
      SUPPORT_TICKET_STATUS.TRIAGE,
      SUPPORT_TICKET_STATUS.ASSIGNED,
      SUPPORT_TICKET_STATUS.IN_PROGRESS,
    ];
    for (const toStatus of path) {
      const step = await transitionTicketStatus(prisma, {
        admin: supportAgent,
        ticketId: id,
        toStatus,
      });
      expect(step.ok).toBe(true);
      expect(step.ticket.status).toBe(toStatus);
    }

    const resolveNoCat = await transitionTicketStatus(prisma, {
      admin: supportAgent,
      ticketId: id,
      toStatus: SUPPORT_TICKET_STATUS.RESOLVED,
    });
    expect(resolveNoCat.ok).toBe(false);
    expect(resolveNoCat.error).toBe('INVALID_TRANSITION');

    const resolved = await transitionTicketStatus(prisma, {
      admin: supportAgent,
      ticketId: id,
      toStatus: SUPPORT_TICKET_STATUS.RESOLVED,
      resolutionCategory: 'FIXED',
    });
    expect(resolved.ok).toBe(true);
    expect(resolved.ticket.resolutionCategory).toBe('FIXED');
    expect(resolved.ticket.resolvedAt).toBeTruthy();

    const closed = await transitionTicketStatus(prisma, {
      admin: supportAgent,
      ticketId: id,
      toStatus: SUPPORT_TICKET_STATUS.CLOSED,
    });
    expect(closed.ok).toBe(true);
    expect(closed.ticket.status).toBe(SUPPORT_TICKET_STATUS.CLOSED);
    expect(closed.ticket.closedAt).toBeTruthy();
  });

  it('CLOSED cannot transition except REOPENED with reason', async () => {
    const prisma = makePrisma();
    const created = await createTicket(prisma, {
      admin: supportAgent,
      tenantId: 'tenant-1',
      title: 'Closed ticket',
      description: 'desc',
      type: 'OTHER',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    const id = created.ticket.id;
    for (const toStatus of [
      SUPPORT_TICKET_STATUS.ACKNOWLEDGED,
      SUPPORT_TICKET_STATUS.TRIAGE,
      SUPPORT_TICKET_STATUS.ASSIGNED,
      SUPPORT_TICKET_STATUS.IN_PROGRESS,
      SUPPORT_TICKET_STATUS.RESOLVED,
      SUPPORT_TICKET_STATUS.CLOSED,
    ]) {
      const step = await transitionTicketStatus(prisma, {
        admin: supportAgent,
        ticketId: id,
        toStatus,
        resolutionCategory:
          toStatus === SUPPORT_TICKET_STATUS.RESOLVED ? 'FIXED' : undefined,
      });
      expect(step.ok).toBe(true);
    }

    const invalid = assertTransition(
      SUPPORT_TICKET_STATUS.CLOSED,
      SUPPORT_TICKET_STATUS.IN_PROGRESS,
      {}
    );
    expect(invalid.ok).toBe(false);
    expect(invalid.error).toBe('INVALID_TRANSITION');
    expect(canTransition(SUPPORT_TICKET_STATUS.CLOSED, SUPPORT_TICKET_STATUS.REOPENED)).toBe(
      true
    );

    const reopenNoReason = await transitionTicketStatus(prisma, {
      admin: supportAgent,
      ticketId: id,
      toStatus: SUPPORT_TICKET_STATUS.REOPENED,
    });
    expect(reopenNoReason.ok).toBe(false);
    expect(reopenNoReason.error).toBe('INVALID_TRANSITION');

    const reopen = await transitionTicketStatus(prisma, {
      admin: supportAgent,
      ticketId: id,
      toStatus: SUPPORT_TICKET_STATUS.REOPENED,
      reason: 'Customer reports issue persists',
    });
    expect(reopen.ok).toBe(true);
    expect(reopen.ticket.status).toBe(SUPPORT_TICKET_STATUS.REOPENED);
    expect(reopen.ticket.resolvedAt).toBeNull();
    expect(reopen.ticket.closedAt).toBeNull();
    expect(reopen.ticket.resolutionCategory).toBeNull();

    // Stale category must not satisfy a later RESOLVED via ?? fallback.
    const resolveWithoutCategory = await transitionTicketStatus(prisma, {
      admin: supportAgent,
      ticketId: id,
      toStatus: SUPPORT_TICKET_STATUS.IN_PROGRESS,
    });
    expect(resolveWithoutCategory.ok).toBe(true);

    const resolveReuse = await transitionTicketStatus(prisma, {
      admin: supportAgent,
      ticketId: id,
      toStatus: SUPPORT_TICKET_STATUS.RESOLVED,
    });
    expect(resolveReuse.ok).toBe(false);
    expect(resolveReuse.error).toBe('INVALID_TRANSITION');
  });

  it('forbids create/list/get/transition without permissions', async () => {
    const prisma = makePrisma();

    const created = await createTicket(prisma, {
      admin: noPerms,
      tenantId: 'tenant-1',
      title: 'Nope',
      description: 'x',
      type: 'QUESTION',
    });
    expect(created.ok).toBe(false);
    expect(created.forbidden).toBe(true);

    const listed = await listTickets(prisma, { admin: noPerms });
    expect(listed.ok).toBe(false);
    expect(listed.forbidden).toBe(true);

    prisma._ticketStore.push({
      id: 'st-existing',
      ticketNumber: 'SUP-2026-000099',
      tenantId: 'tenant-1',
      status: SUPPORT_TICKET_STATUS.NEW,
      title: 'Existing',
      description: 'd',
      type: 'QUESTION',
      sourceChannel: SUPPORT_SOURCE_CHANNEL.ADMIN_MANUAL,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const got = await getTicket(prisma, { admin: noPerms, id: 'st-existing' });
    expect(got.ok).toBe(false);
    expect(got.forbidden).toBe(true);

    const transition = await transitionTicketStatus(prisma, {
      admin: supportViewer,
      ticketId: 'st-existing',
      toStatus: SUPPORT_TICKET_STATUS.ACKNOWLEDGED,
    });
    expect(transition.ok).toBe(false);
    expect(transition.forbidden).toBe(true);
  });

  it('bounds list pagination and never returns unbounded sets', async () => {
    const prisma = makePrisma();
    for (let i = 0; i < 25; i += 1) {
      prisma._ticketStore.push({
        id: `st-${i}`,
        ticketNumber: `SUP-2026-${String(i + 1).padStart(6, '0')}`,
        tenantId: 'tenant-1',
        status: SUPPORT_TICKET_STATUS.NEW,
        title: `T${i}`,
        description: 'd',
        type: 'QUESTION',
        sourceChannel: SUPPORT_SOURCE_CHANNEL.ADMIN_MANUAL,
        createdAt: new Date(Date.UTC(2026, 6, 1, 0, 0, i)),
        updatedAt: new Date(),
      });
    }

    const page = await listTickets(prisma, {
      admin: superAdmin,
      limit: 10,
      offset: 0,
    });
    expect(page.ok).toBe(true);
    expect(page.items.length).toBe(10);
    expect(page.meta.limit).toBe(10);
    expect(page.meta.limit).toBeLessThanOrEqual(100);

    const capped = await listTickets(prisma, {
      admin: superAdmin,
      limit: 9999,
    });
    expect(capped.ok).toBe(true);
    expect(capped.items.length).toBeLessThanOrEqual(100);
    expect(capped.meta.limit).toBeLessThanOrEqual(100);
  });

  it('gets ticket by id or ticketNumber', async () => {
    const prisma = makePrisma();
    const created = await createTicket(prisma, {
      admin: supportAgent,
      tenantId: 'tenant-1',
      title: 'Lookup',
      description: 'd',
      type: 'QUESTION',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    const byId = await getTicket(prisma, {
      admin: supportAgent,
      id: created.ticket.id,
    });
    expect(byId.ok).toBe(true);
    expect(byId.ticket.ticketNumber).toBe(created.ticket.ticketNumber);

    const byNumber = await getTicket(prisma, {
      admin: supportAgent,
      id: created.ticket.ticketNumber,
    });
    expect(byNumber.ok).toBe(true);
    expect(byNumber.ticket.id).toBe(created.ticket.id);

    const missing = await getTicket(prisma, {
      admin: supportAgent,
      id: 'SUP-2026-999999',
    });
    expect(missing.ok).toBe(false);
    expect(missing.notFound).toBe(true);
  });
});
