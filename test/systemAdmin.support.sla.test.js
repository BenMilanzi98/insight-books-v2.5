/**
 * Phase 10 Wave 3 — Support SLA clocks + calendar + policy pinning.
 * Ack / SYSTEM_EVENT ≠ first response by default; breaches immutable.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  SUPPORT_SLA_CLOCK_TYPE,
  SUPPORT_SLA_CLOCK_STATE,
  SUPPORT_DEFAULT_SLA_POLICY_VERSION_ID,
  SUPPORT_DEFAULT_SLA_CALENDAR_VERSION_ID,
  SUPPORT_TICKET_STATUS,
  SUPPORT_MESSAGE_TYPE,
  SUPPORT_QUEUE_CODE,
  getDefaultSlaPolicy,
  getDefaultSlaCalendar,
  elapsedBusinessMs,
  hasSupportSlaClockModel,
  startClocksOnTicketCreate,
  stopFirstResponseOnPublicReply,
  onTicketStatusChangeForSla,
  evaluateClockBreach,
  listClocksForTicket,
  listSlaPolicies,
  createTicket,
  addPublicReply,
  transitionTicketStatus,
  listTickets,
} from '@/lib/admin/support';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { NAV_PERMISSION_MAP } from '@/lib/admin/permissions';
import { listSupportSectionHrefs, SUPPORT_SECTIONS } from '@/lib/admin/supportNav';
import { listAdminNavHrefs } from '@/lib/admin/adminNav';

function makeSlaPrisma(overrides = {}) {
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
      resolutionCategory: null,
      createdAt: new Date('2026-07-30T12:00:00.000Z'),
      updatedAt: new Date('2026-07-30T12:00:00.000Z'),
      resolvedAt: null,
      closedAt: null,
    },
  ];
  const clockStore = overrides._clockStore || [];
  const eventStore = overrides._eventStore || [];
  const messageStore = overrides._messageStore || [];
  const historyStore = overrides._historyStore || [];
  const seqStore = overrides._seqStore || [];

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
                (c) =>
                  (c.id && r.id === c.id) ||
                  (c.ticketNumber && r.ticketNumber === c.ticketNumber)
              )
            ) || null
          );
        }
        return ticketStore[0] || null;
      }),
      findMany: vi.fn(async ({ where = {}, take, skip = 0, orderBy } = {}) => {
        let rows = [...ticketStore];
        if (where?.assigneeAdminId !== undefined) {
          rows = rows.filter((r) => r.assigneeAdminId === where.assigneeAdminId);
        }
        if (where?.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.assigneeAdminId !== undefined) {
                return r.assigneeAdminId === clause.assigneeAdminId;
              }
              if (clause.AND) {
                return clause.AND.every((c) => {
                  if (c.assigneeAdminId === null) return r.assigneeAdminId == null;
                  if (c.queueCode) return r.queueCode === c.queueCode;
                  return true;
                });
              }
              return false;
            })
          );
        }
        if (where?.status) {
          if (where.status.in) {
            const set = new Set(where.status.in);
            rows = rows.filter((r) => set.has(r.status));
          } else {
            rows = rows.filter((r) => r.status === where.status);
          }
        }
        if (where?.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        if (orderBy?.createdAt === 'desc') {
          rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        if (skip) rows = rows.slice(skip);
        if (take != null) rows = rows.slice(0, take);
        return rows;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `st-${ticketStore.length + 1}`,
          resolvedAt: null,
          closedAt: null,
          ...data,
        };
        ticketStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = ticketStore.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      }),
    },
    supportTicketStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `hist-${historyStore.length + 1}`, ...data };
        historyStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...historyStore]),
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
        const row = { ...data };
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
        Object.assign(row, data);
        return { count: 1 };
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
      findMany: vi.fn(async () => [...messageStore]),
    },
    supportSlaClock: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `clk-${clockStore.length + 1}`,
          pausedMs: data.pausedMs || 0,
          breachedAt: data.breachedAt || null,
          stoppedAt: data.stoppedAt || null,
          dueAt: data.dueAt || null,
          ...data,
        };
        clockStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...clockStore];
        if (where.ticketId) rows = rows.filter((r) => r.ticketId === where.ticketId);
        if (where.clockType) rows = rows.filter((r) => r.clockType === where.clockType);
        if (where.state) {
          if (where.state.in) {
            const set = new Set(where.state.in);
            rows = rows.filter((r) => set.has(r.state));
          } else {
            rows = rows.filter((r) => r.state === where.state);
          }
        }
        return rows;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...clockStore];
        if (where.id) rows = rows.filter((r) => r.id === where.id);
        if (where.ticketId) rows = rows.filter((r) => r.ticketId === where.ticketId);
        if (where.clockType) rows = rows.filter((r) => r.clockType === where.clockType);
        if (where.state?.in) {
          const set = new Set(where.state.in);
          rows = rows.filter((r) => set.has(r.state));
        } else if (where.state) {
          rows = rows.filter((r) => r.state === where.state);
        }
        return rows[0] || null;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return clockStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = clockStore.find((r) => r.id === where.id);
        if (!row) throw new Error('clock_not_found');
        Object.assign(row, data);
        return row;
      }),
    },
    supportSlaEvent: {
      create: vi.fn(async ({ data }) => {
        const row = { id: data.id || `evt-${eventStore.length + 1}`, ...data };
        eventStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...eventStore];
        if (where.clockId) rows = rows.filter((r) => r.clockId === where.clockId);
        if (where.eventType) rows = rows.filter((r) => r.eventType === where.eventType);
        return rows;
      }),
      delete: vi.fn(async () => {
        throw new Error('sla_events_immutable');
      }),
      update: vi.fn(async () => {
        throw new Error('sla_events_immutable');
      }),
    },
    supportSlaPolicy: overrides.supportSlaPolicy || undefined,
    supportSlaCalendar: overrides.supportSlaCalendar || undefined,
    $transaction: vi.fn(async (fn) => fn(prisma)),
  };

  prisma._ticketStore = ticketStore;
  prisma._clockStore = clockStore;
  prisma._eventStore = eventStore;
  prisma._messageStore = messageStore;
  return prisma;
}

const superAdmin = { id: 'a-super', role: 'Super Admin', permissions: {} };

const supportAgent = {
  id: 'admin-agent',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      support: {
        viewTickets: true,
        createTickets: true,
        transitionStatus: true,
        replyPublicly: true,
        assignTickets: true,
      },
    },
  },
};

describe('systemAdmin.support.sla', () => {
  it('exposes clock types, default policy/calendar version ids, and manageSla permission', () => {
    expect(SUPPORT_SLA_CLOCK_TYPE.FIRST_RESPONSE).toBe('FIRST_RESPONSE');
    expect(SUPPORT_SLA_CLOCK_TYPE.RESOLUTION).toBe('RESOLUTION');
    expect(SUPPORT_SLA_CLOCK_TYPE.NEXT_RESPONSE).toBe('NEXT_RESPONSE');
    expect(SUPPORT_DEFAULT_SLA_POLICY_VERSION_ID).toBe('sla-policy-default-v1');
    expect(SUPPORT_DEFAULT_SLA_CALENDAR_VERSION_ID).toBe('sla-calendar-default-v1');
    expect(SYSTEM_ADMIN_PERMISSIONS.support.manageSla).toBe(
      'systemAdmin.support.manageSla'
    );
    const policy = getDefaultSlaPolicy();
    expect(policy.versionId).toBe(SUPPORT_DEFAULT_SLA_POLICY_VERSION_ID);
    expect(policy.ackCountsAsFirstResponse).toBe(false);
    expect(policy.targets.FIRST_RESPONSE.businessMs).toBeGreaterThan(0);
    expect(policy.targets.RESOLUTION.businessMs).toBeGreaterThan(0);
    const cal = getDefaultSlaCalendar();
    expect(cal.versionId).toBe(SUPPORT_DEFAULT_SLA_CALENDAR_VERSION_ID);
    expect(cal.timezone).toBeTruthy();
  });

  it('computes elapsed business ms using pinned calendar (skips weekend)', () => {
    const cal = getDefaultSlaCalendar();
    // Friday 16:00 → Monday 09:00 Africa/Blantyre-style weekday calendar (08–17)
    const start = new Date('2026-07-31T14:00:00.000Z'); // Fri 16:00 CAT (UTC+2)
    const end = new Date('2026-08-03T07:00:00.000Z'); // Mon 09:00 CAT
    const ms = elapsedBusinessMs(start, end, cal);
    // Fri 16:00–17:00 = 1h; Mon 08:00–09:00 = 1h → 2 business hours
    expect(ms).toBe(2 * 60 * 60 * 1000);
  });

  it('starts FIRST_RESPONSE + RESOLUTION on ticket create and pins policy+calendar versions', async () => {
    const prisma = makeSlaPrisma({ _ticketStore: [] });
    const now = new Date('2026-07-30T10:00:00.000Z');
    const created = await createTicket(prisma, {
      admin: supportAgent,
      tenantId: 'tenant-1',
      title: 'Login issue',
      description: 'Cannot sign in',
      type: 'ACCOUNT_ACCESS',
      now,
    });
    expect(created.ok).toBe(true);

    const started = await startClocksOnTicketCreate(prisma, {
      ticketId: created.ticket.id,
      now,
    });
    expect(started.ok).toBe(true);
    expect(started.clocks.length).toBeGreaterThanOrEqual(2);

    const fr = started.clocks.find((c) => c.clockType === SUPPORT_SLA_CLOCK_TYPE.FIRST_RESPONSE);
    const res = started.clocks.find((c) => c.clockType === SUPPORT_SLA_CLOCK_TYPE.RESOLUTION);
    expect(fr.state).toBe(SUPPORT_SLA_CLOCK_STATE.RUNNING);
    expect(res.state).toBe(SUPPORT_SLA_CLOCK_STATE.RUNNING);
    expect(fr.policyVersion).toBe(SUPPORT_DEFAULT_SLA_POLICY_VERSION_ID);
    expect(fr.calendarVersion).toBe(SUPPORT_DEFAULT_SLA_CALENDAR_VERSION_ID);
    expect(res.policyVersion).toBe(SUPPORT_DEFAULT_SLA_POLICY_VERSION_ID);
  });

  it('stops FIRST_RESPONSE on PUBLIC_AGENT_REPLY but not SYSTEM_EVENT or ACK alone', async () => {
    const prisma = makeSlaPrisma();
    const t0 = new Date('2026-07-30T08:00:00.000Z');
    await startClocksOnTicketCreate(prisma, { ticketId: 'st-1', now: t0 });

    const ackNow = new Date('2026-07-30T08:30:00.000Z');
    await onTicketStatusChangeForSla(prisma, {
      ticketId: 'st-1',
      fromStatus: SUPPORT_TICKET_STATUS.NEW,
      toStatus: SUPPORT_TICKET_STATUS.ACKNOWLEDGED,
      now: ackNow,
    });

    let fr = prisma._clockStore.find(
      (c) => c.clockType === SUPPORT_SLA_CLOCK_TYPE.FIRST_RESPONSE
    );
    expect(fr.state).toBe(SUPPORT_SLA_CLOCK_STATE.RUNNING);

    // SYSTEM_EVENT must not stop
    await stopFirstResponseOnPublicReply(prisma, {
      ticketId: 'st-1',
      now: new Date('2026-07-30T08:45:00.000Z'),
      messageType: SUPPORT_MESSAGE_TYPE.SYSTEM_EVENT,
    });
    fr = prisma._clockStore.find(
      (c) => c.clockType === SUPPORT_SLA_CLOCK_TYPE.FIRST_RESPONSE
    );
    expect(fr.state).toBe(SUPPORT_SLA_CLOCK_STATE.RUNNING);

    const reply = await addPublicReply(prisma, {
      admin: supportAgent,
      ticketId: 'st-1',
      body: 'We are looking into this.',
    });
    expect(reply.ok).toBe(true);

    fr = prisma._clockStore.find(
      (c) => c.clockType === SUPPORT_SLA_CLOCK_TYPE.FIRST_RESPONSE
    );
    expect(fr.state).toBe(SUPPORT_SLA_CLOCK_STATE.STOPPED);
    expect(fr.stoppedAt).toBeTruthy();
  });

  it('does not treat ack as first response unless policy ackCountsAsFirstResponse', async () => {
    const prisma = makeSlaPrisma();
    const t0 = new Date('2026-07-30T08:00:00.000Z');
    await startClocksOnTicketCreate(prisma, { ticketId: 'st-1', now: t0 });

    const policyTrue = {
      ...getDefaultSlaPolicy(),
      ackCountsAsFirstResponse: true,
    };
    await onTicketStatusChangeForSla(prisma, {
      ticketId: 'st-1',
      fromStatus: SUPPORT_TICKET_STATUS.NEW,
      toStatus: SUPPORT_TICKET_STATUS.ACKNOWLEDGED,
      now: new Date('2026-07-30T08:10:00.000Z'),
      policy: policyTrue,
    });
    const fr = prisma._clockStore.find(
      (c) => c.clockType === SUPPORT_SLA_CLOCK_TYPE.FIRST_RESPONSE
    );
    expect(fr.state).toBe(SUPPORT_SLA_CLOCK_STATE.STOPPED);
  });

  it('pauses on WAITING_* per policy flags and stops RESOLUTION on RESOLVED', async () => {
    const prisma = makeSlaPrisma();
    prisma._ticketStore[0].status = SUPPORT_TICKET_STATUS.IN_PROGRESS;
    const t0 = new Date('2026-07-30T08:00:00.000Z');
    await startClocksOnTicketCreate(prisma, { ticketId: 'st-1', now: t0 });

    await onTicketStatusChangeForSla(prisma, {
      ticketId: 'st-1',
      fromStatus: SUPPORT_TICKET_STATUS.IN_PROGRESS,
      toStatus: SUPPORT_TICKET_STATUS.WAITING_FOR_CUSTOMER,
      now: new Date('2026-07-30T09:00:00.000Z'),
    });

    let res = prisma._clockStore.find(
      (c) => c.clockType === SUPPORT_SLA_CLOCK_TYPE.RESOLUTION
    );
    expect(res.state).toBe(SUPPORT_SLA_CLOCK_STATE.PAUSED);

    await onTicketStatusChangeForSla(prisma, {
      ticketId: 'st-1',
      fromStatus: SUPPORT_TICKET_STATUS.WAITING_FOR_CUSTOMER,
      toStatus: SUPPORT_TICKET_STATUS.IN_PROGRESS,
      now: new Date('2026-07-30T10:00:00.000Z'),
    });
    res = prisma._clockStore.find(
      (c) => c.clockType === SUPPORT_SLA_CLOCK_TYPE.RESOLUTION
    );
    expect(res.state).toBe(SUPPORT_SLA_CLOCK_STATE.RUNNING);

    await onTicketStatusChangeForSla(prisma, {
      ticketId: 'st-1',
      fromStatus: SUPPORT_TICKET_STATUS.IN_PROGRESS,
      toStatus: SUPPORT_TICKET_STATUS.RESOLVED,
      now: new Date('2026-07-30T11:00:00.000Z'),
    });
    res = prisma._clockStore.find(
      (c) => c.clockType === SUPPORT_SLA_CLOCK_TYPE.RESOLUTION
    );
    expect(res.state).toBe(SUPPORT_SLA_CLOCK_STATE.STOPPED);
  });

  it('records immutable BREACHED event and never deletes breach facts', async () => {
    const prisma = makeSlaPrisma();
    const t0 = new Date('2026-07-01T06:00:00.000Z'); // Wed 08:00 CAT
    await startClocksOnTicketCreate(prisma, { ticketId: 'st-1', now: t0 });

    const fr = prisma._clockStore.find(
      (c) => c.clockType === SUPPORT_SLA_CLOCK_TYPE.FIRST_RESPONSE
    );
    // Force dueAt in the past
    fr.dueAt = new Date('2026-07-01T07:00:00.000Z');
    fr.targetBusinessMs = 60 * 60 * 1000;

    const evalNow = new Date('2026-07-01T12:00:00.000Z');
    const result = await evaluateClockBreach(prisma, { clockId: fr.id, now: evalNow });
    expect(result.ok).toBe(true);
    expect(result.breached).toBe(true);
    expect(fr.state).toBe(SUPPORT_SLA_CLOCK_STATE.BREACHED);

    const breachEvents = prisma._eventStore.filter(
      (e) => e.clockId === fr.id && e.eventType === 'BREACHED'
    );
    expect(breachEvents.length).toBe(1);

    // Re-evaluate must not create duplicate breach or mutate prior breach event
    const again = await evaluateClockBreach(prisma, { clockId: fr.id, now: evalNow });
    expect(again.breached).toBe(true);
    expect(
      prisma._eventStore.filter((e) => e.clockId === fr.id && e.eventType === 'BREACHED')
        .length
    ).toBe(1);
    expect(breachEvents[0].at).toEqual(prisma._eventStore.find((e) => e.id === breachEvents[0].id).at);

    await expect(prisma.supportSlaEvent.delete({ where: { id: breachEvents[0].id } })).rejects.toThrow(
      /immutable/i
    );
  });

  it('returns NOT_AVAILABLE / UNAVAILABLE when SLA tables missing — never fake 0% breach', async () => {
    const prisma = { supportTicket: { findUnique: vi.fn(async () => ({ id: 'st-1' })) } };
    expect(hasSupportSlaClockModel(prisma)).toBe(false);

    const listed = await listClocksForTicket(prisma, {
      admin: supportAgent,
      ticketId: 'st-1',
    });
    expect(listed.ok).toBe(true);
    expect(listed.status === 'UNAVAILABLE' || listed.status === 'NOT_AVAILABLE').toBe(true);
    expect(listed.items).toEqual([]);
    expect(listed.meta?.breachRate).toBeUndefined();
    expect(listed.meta?.breachPercent).toBeUndefined();
  });

  it('listClocksForTicket returns UNAVAILABLE when findMany throws — never empty AVAILABLE with fake 0%', async () => {
    const prisma = makeSlaPrisma();
    prisma.supportSlaClock.findMany = vi.fn(async () => {
      throw new Error('P2021: table support_sla_clock does not exist');
    });

    const listed = await listClocksForTicket(prisma, {
      admin: supportAgent,
      ticketId: 'st-1',
      evaluate: false,
    });

    expect(listed.ok).toBe(false);
    expect(listed.status).toBe('UNAVAILABLE');
    expect(listed.items).toEqual([]);
    expect(listed.meta?.breachRate).toBeUndefined();
    expect(listed.meta?.breachPercent).toBeUndefined();
    expect(listed.meta?.count).toBeUndefined();
  });

  it('evaluateClockBreach never falls back to findMany({}) all clocks', async () => {
    const findMany = vi.fn(async () => [{ id: 'clk-hidden' }]);
    const prisma = {
      supportSlaClock: {
        create: vi.fn(),
        findMany,
        // No findUnique / findFirst — must soft-fail, not scan all
      },
      supportSlaEvent: { create: vi.fn(), findMany: vi.fn(async () => []) },
    };
    expect(hasSupportSlaClockModel(prisma)).toBe(true);

    const result = await evaluateClockBreach(prisma, { clockId: 'clk-hidden' });
    expect(findMany).not.toHaveBeenCalled();
    expect(result.breached).toBe(false);
    expect(result.status).toBe('UNAVAILABLE');
  });

  it('resume/status hooks honor pinned calendarVersion — not latest args.calendar defaults', async () => {
    const prisma = makeSlaPrisma();
    const pinnedCal = Object.freeze({
      versionId: 'sla-calendar-pinned-v9',
      timezone: 'UTC',
      workdays: Object.freeze([1, 2, 3, 4, 5]),
      // Narrow window so pause-business math differs from default Africa/Blantyre
      workingHours: Object.freeze({ start: '00:00', end: '23:59' }),
      holidays: Object.freeze([]),
    });
    const latestCal = Object.freeze({
      ...getDefaultSlaCalendar(),
      versionId: 'sla-calendar-latest-v99',
      timezone: 'Africa/Blantyre',
      workingHours: Object.freeze({ start: '08:00', end: '17:00' }),
    });

    prisma.supportSlaCalendar = {
      findUnique: vi.fn(async ({ where } = {}) => {
        if (where?.versionId === pinnedCal.versionId) {
          return {
            versionId: pinnedCal.versionId,
            name: 'Pinned',
            timezone: pinnedCal.timezone,
            definitionJson: JSON.stringify({
              workdays: pinnedCal.workdays,
              workingHours: pinnedCal.workingHours,
              holidays: pinnedCal.holidays,
            }),
            active: true,
          };
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where } = {}) => {
        if (where?.versionId === pinnedCal.versionId) {
          return {
            versionId: pinnedCal.versionId,
            name: 'Pinned',
            timezone: pinnedCal.timezone,
            definitionJson: JSON.stringify({
              workdays: pinnedCal.workdays,
              workingHours: pinnedCal.workingHours,
              holidays: pinnedCal.holidays,
            }),
            active: true,
          };
        }
        return null;
      }),
    };

    const t0 = new Date('2026-07-30T08:00:00.000Z'); // Thu
    await startClocksOnTicketCreate(prisma, {
      ticketId: 'st-1',
      now: t0,
      calendar: pinnedCal,
      policy: getDefaultSlaPolicy(),
    });

    const res = prisma._clockStore.find(
      (c) => c.clockType === SUPPORT_SLA_CLOCK_TYPE.RESOLUTION
    );
    expect(res.calendarVersion).toBe('sla-calendar-pinned-v9');
    const dueBeforePause = new Date(res.dueAt).getTime();

    // Pause after Blantyre close (18:00 CAT = 16:00 UTC) so latest calendar
    // counts 0 business ms while pinned UTC 00:00–23:59 counts full wall time.
    const pausedAt = new Date('2026-07-30T16:00:00.000Z');
    await onTicketStatusChangeForSla(prisma, {
      ticketId: 'st-1',
      fromStatus: SUPPORT_TICKET_STATUS.IN_PROGRESS,
      toStatus: SUPPORT_TICKET_STATUS.WAITING_FOR_CUSTOMER,
      now: pausedAt,
      calendar: latestCal,
    });
    expect(res.state).toBe(SUPPORT_SLA_CLOCK_STATE.PAUSED);

    const resumeAt = new Date('2026-07-30T18:00:00.000Z'); // 2h wall pause
    const expectedPinnedExtend = elapsedBusinessMs(pausedAt, resumeAt, pinnedCal);
    const expectedLatestExtend = elapsedBusinessMs(pausedAt, resumeAt, latestCal);
    expect(expectedPinnedExtend).toBe(2 * 60 * 60 * 1000);
    expect(expectedLatestExtend).toBe(0);

    const resumed = await onTicketStatusChangeForSla(prisma, {
      ticketId: 'st-1',
      fromStatus: SUPPORT_TICKET_STATUS.WAITING_FOR_CUSTOMER,
      toStatus: SUPPORT_TICKET_STATUS.IN_PROGRESS,
      now: resumeAt,
      calendar: latestCal, // must NOT silently drive elapsed math
    });
    expect(resumed.ok).toBe(true);
    expect(resumed.status).not.toBe('UNAVAILABLE');
    expect(res.state).toBe(SUPPORT_SLA_CLOCK_STATE.RUNNING);
    expect(new Date(res.dueAt).getTime() - dueBeforePause).toBe(expectedPinnedExtend);

    // Missing pinned calendar → soft-fail, no invented resume math
    res.state = SUPPORT_SLA_CLOCK_STATE.PAUSED;
    res.pausedAt = new Date('2026-07-30T13:00:00.000Z');
    res.calendarVersion = 'sla-calendar-gone-v0';
    const dueFrozen = new Date(res.dueAt).getTime();
    const soft = await onTicketStatusChangeForSla(prisma, {
      ticketId: 'st-1',
      fromStatus: SUPPORT_TICKET_STATUS.WAITING_FOR_CUSTOMER,
      toStatus: SUPPORT_TICKET_STATUS.IN_PROGRESS,
      now: new Date('2026-07-30T14:00:00.000Z'),
      calendar: latestCal,
    });
    expect(soft.status).toBe('UNAVAILABLE');
    expect(res.state).toBe(SUPPORT_SLA_CLOCK_STATE.PAUSED);
    expect(new Date(res.dueAt).getTime()).toBe(dueFrozen);
  });

  it('listTickets supports assigneeAdminId for My Work and optional GENERAL_SUPPORT queue stub', async () => {
    const prisma = makeSlaPrisma({
      _ticketStore: [
        {
          id: 'mine',
          ticketNumber: 'SUP-2026-000010',
          tenantId: 'tenant-1',
          status: 'ASSIGNED',
          type: 'QUESTION',
          title: 'Mine',
          description: 'd',
          assigneeAdminId: 'admin-agent',
          queueCode: SUPPORT_QUEUE_CODE.GENERAL_SUPPORT,
          createdAt: new Date('2026-07-30T12:00:00.000Z'),
          updatedAt: new Date('2026-07-30T12:00:00.000Z'),
        },
        {
          id: 'unassigned',
          ticketNumber: 'SUP-2026-000011',
          tenantId: 'tenant-1',
          status: 'NEW',
          type: 'QUESTION',
          title: 'Queue',
          description: 'd',
          assigneeAdminId: null,
          queueCode: SUPPORT_QUEUE_CODE.GENERAL_SUPPORT,
          createdAt: new Date('2026-07-30T11:00:00.000Z'),
          updatedAt: new Date('2026-07-30T11:00:00.000Z'),
        },
        {
          id: 'other',
          ticketNumber: 'SUP-2026-000012',
          tenantId: 'tenant-1',
          status: 'ASSIGNED',
          type: 'QUESTION',
          title: 'Other',
          description: 'd',
          assigneeAdminId: 'someone-else',
          queueCode: SUPPORT_QUEUE_CODE.BILLING,
          createdAt: new Date('2026-07-30T10:00:00.000Z'),
          updatedAt: new Date('2026-07-30T10:00:00.000Z'),
        },
      ],
    });

    const mine = await listTickets(prisma, {
      admin: supportAgent,
      assigneeAdminId: 'admin-agent',
    });
    expect(mine.ok).toBe(true);
    expect(mine.items.map((i) => i.id)).toEqual(['mine']);

    const myWork = await listTickets(prisma, {
      admin: supportAgent,
      myWork: true,
    });
    expect(myWork.ok).toBe(true);
    const ids = myWork.items.map((i) => i.id).sort();
    expect(ids).toEqual(['mine', 'unassigned'].sort());
    expect(ids).not.toContain('other');
  });

  it('listSlaPolicies is readable with viewTickets; nav map includes Support sections', () => {
    expect(NAV_PERMISSION_MAP['/insightbooks/support']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.support.viewTickets
    );
    expect(NAV_PERMISSION_MAP['/insightbooks/support/tickets']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.support.viewTickets
    );
    expect(NAV_PERMISSION_MAP['/insightbooks/support/my-work']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.support.viewTickets
    );

    const hrefs = listSupportSectionHrefs();
    expect(hrefs).toContain('/insightbooks/support');
    expect(hrefs).toContain('/insightbooks/support/tickets');
    expect(SUPPORT_SECTIONS.some((s) => s.id === 'my-work')).toBe(true);
    expect(SUPPORT_SECTIONS.some((s) => s.id === 'tickets')).toBe(true);

    const navHrefs = listAdminNavHrefs();
    expect(navHrefs.some((h) => h.startsWith('/insightbooks/support'))).toBe(true);
  });

  it('listSlaPolicies returns default pinned catalogue when DB policy table absent', async () => {
    const prisma = makeSlaPrisma();
    const result = await listSlaPolicies(prisma, { admin: supportAgent });
    expect(result.ok).toBe(true);
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.items[0].versionId).toBe(SUPPORT_DEFAULT_SLA_POLICY_VERSION_ID);
  });

  it('createTicket + addPublicReply integration starts and stops FIRST_RESPONSE', async () => {
    const prisma = makeSlaPrisma({ _ticketStore: [] });
    const created = await createTicket(prisma, {
      admin: supportAgent,
      tenantId: 'tenant-1',
      title: 'Integration SLA',
      description: 'desc',
      now: new Date('2026-07-30T08:00:00.000Z'),
    });
    expect(created.ok).toBe(true);
    expect(
      prisma._clockStore.some((c) => c.clockType === SUPPORT_SLA_CLOCK_TYPE.FIRST_RESPONSE)
    ).toBe(true);

    await addPublicReply(prisma, {
      admin: supportAgent,
      ticketId: created.ticket.id,
      body: 'Human reply',
    });

    const fr = prisma._clockStore.find(
      (c) =>
        c.ticketId === created.ticket.id &&
        c.clockType === SUPPORT_SLA_CLOCK_TYPE.FIRST_RESPONSE
    );
    expect(fr.state).toBe(SUPPORT_SLA_CLOCK_STATE.STOPPED);
  });

  it('transition to RESOLVED stops RESOLUTION clock via ticket hook', async () => {
    const prisma = makeSlaPrisma();
    prisma._ticketStore[0].status = SUPPORT_TICKET_STATUS.IN_PROGRESS;
    await startClocksOnTicketCreate(prisma, {
      ticketId: 'st-1',
      now: new Date('2026-07-30T08:00:00.000Z'),
    });

    const result = await transitionTicketStatus(prisma, {
      admin: supportAgent,
      ticketId: 'st-1',
      toStatus: SUPPORT_TICKET_STATUS.RESOLVED,
      resolutionCategory: 'FIXED',
      reason: 'done',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(result.ok).toBe(true);

    const res = prisma._clockStore.find(
      (c) => c.clockType === SUPPORT_SLA_CLOCK_TYPE.RESOLUTION
    );
    expect(res.state).toBe(SUPPORT_SLA_CLOCK_STATE.STOPPED);
  });
});
