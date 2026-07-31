/**
 * Phase 14 Wave 1 — Demo Request + Demo + schedule + participants + readiness.
 * Demo ≠ Meeting; convert idempotent; RSVP ≠ attendance; no Proposal/Tenant.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CRM_DEMO_NUMBER_RE,
  CRM_DEMO_REQUEST_NUMBER_RE,
  CRM_DEMO_REQUEST_STATUS,
  CRM_DEMO_STATUS,
  CRM_DEMO_PARTICIPANT_ROLE,
  CRM_DEMO_PARTICIPANT_TYPE,
  CRM_READINESS_STATUS,
  CRM_MEETING_NUMBER_RE,
  allocateDemoRequestNumber,
  allocateDemoNumber,
  createDemoRequest,
  qualifyDemoRequest,
  rejectDemoRequest,
  convertDemoRequest,
  createDemo,
  getDemo,
  listDemos,
  transitionDemoStatus,
  scheduleDemo,
  evaluateDemoReadiness,
  addDemoParticipant,
  removeDemoParticipant,
  getDemoDomainContract,
} from '@/lib/admin/crm';

function makeAdmin(id, crmPerms = {}, role = 'Platform Support') {
  return {
    id,
    role,
    permissions: {
      systemAdmin: {
        crm: { ...crmPerms },
      },
    },
  };
}

function superAdmin(id = 'super-1') {
  return { id, role: 'Super Admin', permissions: {} };
}

function makePrisma(overrides = {}) {
  const seqStore = overrides._seqStore || [];
  const activityStore = overrides._activityStore || [];
  const statusHistoryStore = overrides._statusHistoryStore || [];
  const relationStore = overrides._relationStore || [];
  const participantStore = overrides._participantStore || [];
  const meetingStore = overrides._meetingStore || [];
  const meetingParticipantStore = overrides._meetingParticipantStore || [];
  const rescheduleStore = overrides._rescheduleStore || [];
  const calendarStore = overrides._calendarStore || [];
  const followUpStore = overrides._followUpStore || [];
  const timelineStore = overrides._timelineStore || [];
  const consentStore = overrides._consentStore || [];
  const dncStore = overrides._dncStore || [];
  const demoRequestStore = overrides._demoRequestStore || [];
  const demoStore = overrides._demoStore || [];
  const demoParticipantStore = overrides._demoParticipantStore || [];
  const demoStatusHistoryStore = overrides._demoStatusHistoryStore || [];
  const contactStore = overrides._contactStore || [
    { id: 'con-ok', contactNumber: 'CON-2026-000001', email: 'ok@example.com' },
  ];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    crmNumberSeq: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        const key = where.prefix_year || where;
        return (
          seqStore.find((r) => r.prefix === key.prefix && r.year === key.year) || null
        );
      }),
      create: vi.fn(async ({ data }) => {
        const row = { ...data, updatedAt: new Date() };
        seqStore.push(row);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const row = seqStore.find(
          (r) =>
            r.prefix === where.prefix &&
            r.year === where.year &&
            r.lastIssued === where.lastIssued
        );
        if (!row) return { count: 0 };
        row.lastIssued = data.lastIssued;
        return { count: 1 };
      }),
    },
    crmActivity: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `act-${activityStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        activityStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return activityStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return activityStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = activityStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmActivityStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `ash-${statusHistoryStore.length + 1}`, ...data };
        statusHistoryStore.push(row);
        return row;
      }),
    },
    crmActivityRelation: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `rel-${relationStore.length + 1}`, ...data };
        relationStore.push(row);
        return row;
      }),
    },
    crmActivityParticipant: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `part-${participantStore.length + 1}`, ...data };
        participantStore.push(row);
        return row;
      }),
    },
    crmMeeting: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `meet-${meetingStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          outcome: data.outcome ?? null,
          consentBlocked: data.consentBlocked === true,
          eligibilityJson: data.eligibilityJson ?? null,
          ...data,
        };
        meetingStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return meetingStore.find((r) => r.id === where.id) || null;
        if (where.meetingNumber) {
          return meetingStore.find((r) => r.meetingNumber === where.meetingNumber) || null;
        }
        if (where.idempotencyKey) {
          return meetingStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...meetingStore];
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.ownerAdminId) {
          rows = rows.filter((r) => r.ownerAdminId === where.ownerAdminId);
        }
        if (where.AND) {
          for (const clause of where.AND) {
            if (clause.startsAtUtc?.lt) {
              rows = rows.filter((r) => new Date(r.startsAtUtc) < new Date(clause.startsAtUtc.lt));
            }
            if (clause.endsAtUtc?.gt) {
              rows = rows.filter((r) => new Date(r.endsAtUtc) > new Date(clause.endsAtUtc.gt));
            }
            if (clause.status?.not) {
              rows = rows.filter((r) => r.status !== clause.status.not);
            }
            if (clause.status?.in) {
              rows = rows.filter((r) => clause.status.in.includes(r.status));
            }
            if (clause.id?.not) {
              rows = rows.filter((r) => r.id !== clause.id.not);
            }
            if (clause.ownerAdminId) {
              rows = rows.filter((r) => r.ownerAdminId === clause.ownerAdminId);
            }
          }
        }
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = meetingStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmMeetingParticipant: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `mp-${meetingParticipantStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        meetingParticipantStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...meetingParticipantStore];
        if (where.meetingId) rows = rows.filter((r) => r.meetingId === where.meetingId);
        return rows;
      }),
    },
    crmMeetingRescheduleHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `mrh-${rescheduleStore.length + 1}`, ...data };
        rescheduleStore.push(row);
        return row;
      }),
    },
    crmCalendarEvent: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `cal-${calendarStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        calendarStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...calendarStore];
        if (where.meetingId) rows = rows.filter((r) => r.meetingId === where.meetingId);
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.ownerAdminId) {
          rows = rows.filter((r) => r.ownerAdminId === where.ownerAdminId);
        }
        if (where.AND) {
          for (const clause of where.AND) {
            if (clause.startsAtUtc?.lt) {
              rows = rows.filter((r) => new Date(r.startsAtUtc) < new Date(clause.startsAtUtc.lt));
            }
            if (clause.endsAtUtc?.gt) {
              rows = rows.filter((r) => new Date(r.endsAtUtc) > new Date(clause.endsAtUtc.gt));
            }
            if (clause.status?.not) {
              rows = rows.filter((r) => r.status !== clause.status.not);
            }
            if (clause.meetingId?.not) {
              rows = rows.filter((r) => r.meetingId !== clause.meetingId.not);
            }
            if (clause.ownerAdminId) {
              rows = rows.filter((r) => r.ownerAdminId === clause.ownerAdminId);
            }
          }
        }
        return rows;
      }),
      updateMany: vi.fn(async ({ where = {}, data = {} } = {}) => {
        let count = 0;
        for (const row of calendarStore) {
          if (where.meetingId && row.meetingId !== where.meetingId) continue;
          Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
          count += 1;
        }
        return { count };
      }),
    },
    crmDemoRequest: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `dmr-${demoRequestStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          convertedDemoId: data.convertedDemoId ?? null,
          convertIdempotencyKey: data.convertIdempotencyKey ?? null,
          ...data,
        };
        demoRequestStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return demoRequestStore.find((r) => r.id === where.id) || null;
        if (where.requestNumber) {
          return demoRequestStore.find((r) => r.requestNumber === where.requestNumber) || null;
        }
        if (where.idempotencyKey) {
          return demoRequestStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        if (where.convertIdempotencyKey) {
          return (
            demoRequestStore.find(
              (r) => r.convertIdempotencyKey === where.convertIdempotencyKey
            ) || null
          );
        }
        return null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...demoRequestStore];
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.leadId) rows = rows.filter((r) => r.leadId === where.leadId);
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = demoRequestStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmDemo: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `demo-${demoStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          meetingId: data.meetingId ?? null,
          calendarEventId: data.calendarEventId ?? null,
          readinessJson: data.readinessJson ?? null,
          ...data,
        };
        demoStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return demoStore.find((r) => r.id === where.id) || null;
        if (where.demoNumber) {
          return demoStore.find((r) => r.demoNumber === where.demoNumber) || null;
        }
        if (where.idempotencyKey) {
          return demoStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        if (where.convertIdempotencyKey) {
          return (
            demoStore.find((r) => r.convertIdempotencyKey === where.convertIdempotencyKey) ||
            null
          );
        }
        if (where.scheduleIdempotencyKey) {
          return (
            demoStore.find((r) => r.scheduleIdempotencyKey === where.scheduleIdempotencyKey) ||
            null
          );
        }
        return null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...demoStore];
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.leadId) rows = rows.filter((r) => r.leadId === where.leadId);
        if (where.opportunityId) {
          rows = rows.filter((r) => r.opportunityId === where.opportunityId);
        }
        if (where.requestId) rows = rows.filter((r) => r.requestId === where.requestId);
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = demoStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmDemoParticipant: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `dp-${demoParticipantStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          attendanceStatus: data.attendanceStatus || 'UNKNOWN',
          rsvpStatus: data.rsvpStatus || 'PENDING',
          ...data,
        };
        demoParticipantStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return demoParticipantStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          demoParticipantStore.find(
            (r) =>
              (!where.demoId || r.demoId === where.demoId) &&
              (!where.participantType || r.participantType === where.participantType) &&
              (!where.participantId || r.participantId === where.participantId) &&
              (!where.role || r.role === where.role)
          ) || null
        );
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...demoParticipantStore];
        if (where.demoId) rows = rows.filter((r) => r.demoId === where.demoId);
        return rows;
      }),
      delete: vi.fn(async ({ where = {} } = {}) => {
        const idx = demoParticipantStore.findIndex((r) => r.id === where.id);
        if (idx < 0) throw new Error('not found');
        const [row] = demoParticipantStore.splice(idx, 1);
        return row;
      }),
    },
    crmDemoStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `dsh-${demoStatusHistoryStore.length + 1}`, ...data };
        demoStatusHistoryStore.push(row);
        return row;
      }),
    },
    crmFollowUp: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `fu-${followUpStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        followUpStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return followUpStore.find((r) => r.id === where.id) || null;
        return null;
      }),
    },
    crmContact: {
      findMany: vi.fn(async () => [...contactStore]),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return contactStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        if (where.OR) {
          return (
            contactStore.find((r) =>
              where.OR.some(
                (c) =>
                  (c.id && r.id === c.id) ||
                  (c.contactNumber && r.contactNumber === c.contactNumber)
              )
            ) || null
          );
        }
        if (where.id) return contactStore.find((r) => r.id === where.id) || null;
        return null;
      }),
    },
    crmFollowUpHistory: {
      create: vi.fn(async ({ data }) => data),
    },
    crmTimelineEvent: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `tl-${timelineStore.length + 1}`, ...data };
        timelineStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...timelineStore]),
    },
    crmConsentRecord: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `cons-${consentStore.length + 1}`, ...data };
        consentStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...consentStore];
        if (where.contactId) rows = rows.filter((r) => r.contactId === where.contactId);
        return rows;
      }),
      findFirst: vi.fn(async () => null),
    },
    crmDoNotContact: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `dnc-${dncStore.length + 1}`, ...data };
        dncStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...dncStore]),
      findFirst: vi.fn(async () => null),
    },
    _stores: {
      seqStore,
      demoRequestStore,
      demoStore,
      demoParticipantStore,
      meetingStore,
      calendarStore,
      timelineStore,
    },
  };

  return prisma;
}

describe('Phase 14 Wave 1 — Demo Request + Demo spine', () => {
  let prisma;
  let admin;

  beforeEach(() => {
    prisma = makePrisma();
    admin = superAdmin();
  });

  it('allocates unique immutable DMR and DEMO numbers', async () => {
    const dmr = await allocateDemoRequestNumber(prisma);
    const demo = await allocateDemoNumber(prisma);
    expect(dmr.ok).toBe(true);
    expect(demo.ok).toBe(true);
    expect(dmr.number).toMatch(CRM_DEMO_REQUEST_NUMBER_RE);
    expect(demo.number).toMatch(CRM_DEMO_NUMBER_RE);

    const dmr2 = await allocateDemoRequestNumber(prisma);
    const demo2 = await allocateDemoNumber(prisma);
    expect(dmr2.number).not.toBe(dmr.number);
    expect(demo2.number).not.toBe(demo.number);
  });

  it('creates, qualifies, rejects demo requests', async () => {
    const created = await createDemoRequest(prisma, {
      admin,
      title: 'Acme demo',
      leadId: 'lead-1',
      contactId: 'con-ok',
      source: 'REQUEST_DEMO',
    });
    expect(created.ok).toBe(true);
    expect(created.request.requestNumber).toMatch(CRM_DEMO_REQUEST_NUMBER_RE);
    expect(created.request.status).toBe(CRM_DEMO_REQUEST_STATUS.NEW);

    const qualified = await qualifyDemoRequest(prisma, {
      admin,
      requestId: created.request.id,
    });
    expect(qualified.ok).toBe(true);
    expect(qualified.request.status).toBe(CRM_DEMO_REQUEST_STATUS.QUALIFIED);

    const req2 = await createDemoRequest(prisma, {
      admin,
      title: 'Reject me',
      leadId: 'lead-2',
    });
    const rejected = await rejectDemoRequest(prisma, {
      admin,
      requestId: req2.request.id,
      reason: 'Not a fit',
    });
    expect(rejected.ok).toBe(true);
    expect(rejected.request.status).toBe(CRM_DEMO_REQUEST_STATUS.REJECTED);
  });

  it('convert is idempotent — exact retry returns existing Demo', async () => {
    const created = await createDemoRequest(prisma, {
      admin,
      title: 'Convert path',
      leadId: 'lead-c',
      contactId: 'con-ok',
      opportunityId: 'opp-1',
    });
    await qualifyDemoRequest(prisma, { admin, requestId: created.request.id });

    const first = await convertDemoRequest(prisma, {
      admin,
      requestId: created.request.id,
    });
    expect(first.ok).toBe(true);
    expect(first.alreadyExists).toBeFalsy();
    expect(first.demo.demoNumber).toMatch(CRM_DEMO_NUMBER_RE);
    expect(first.request.status).toBe(CRM_DEMO_REQUEST_STATUS.CONVERTED);
    expect(first.demo.proposalCreated).toBe(false);
    expect(first.demo.tenantProvisioned).toBe(false);

    const second = await convertDemoRequest(prisma, {
      admin,
      requestId: created.request.id,
    });
    expect(second.ok).toBe(true);
    expect(second.alreadyExists).toBe(true);
    expect(second.demo.id).toBe(first.demo.id);
    expect(second.demo.demoNumber).toBe(first.demo.demoNumber);
    expect(prisma._stores.demoStore.length).toBe(1);
  });

  it('schedule creates Meeting + Calendar and reconciles times; end-before-start blocked', async () => {
    const demo = await createDemo(prisma, {
      admin,
      title: 'Schedule me',
      contactId: 'con-ok',
      leadId: 'lead-s',
    });
    expect(demo.ok).toBe(true);

    const bad = await scheduleDemo(prisma, {
      admin,
      demoId: demo.demo.id,
      timezone: 'Africa/Blantyre',
      startsAt: '2026-08-01T10:00:00.000Z',
      endsAt: '2026-08-01T09:00:00.000Z',
    });
    expect(bad.ok).toBe(false);
    expect(bad.error).toBe('end_before_start');

    const noTz = await scheduleDemo(prisma, {
      admin,
      demoId: demo.demo.id,
      startsAt: '2026-08-01T10:00:00.000Z',
      endsAt: '2026-08-01T11:00:00.000Z',
    });
    expect(noTz.ok).toBe(false);
    expect(noTz.error).toBe('timezone_required');

    const scheduled = await scheduleDemo(prisma, {
      admin,
      demoId: demo.demo.id,
      timezone: 'Africa/Blantyre',
      startsAt: '2026-08-01T10:00:00.000Z',
      endsAt: '2026-08-01T11:00:00.000Z',
      idempotencyKey: 'sched-1',
    });
    expect(scheduled.ok).toBe(true);
    expect(scheduled.demo.status).toBe(CRM_DEMO_STATUS.SCHEDULED);
    expect(scheduled.demo.meetingId).toBeTruthy();
    expect(scheduled.demo.calendarEventId).toBeTruthy();
    expect(scheduled.meeting.meetingNumber).toMatch(CRM_MEETING_NUMBER_RE);
    expect(scheduled.demo.startsAtUtc).toBe('2026-08-01T10:00:00.000Z');
    expect(scheduled.demo.endsAtUtc).toBe('2026-08-01T11:00:00.000Z');
    expect(scheduled.demo.timezone).toBe('Africa/Blantyre');

    const retry = await scheduleDemo(prisma, {
      admin,
      demoId: demo.demo.id,
      timezone: 'Africa/Blantyre',
      startsAt: '2026-08-01T10:00:00.000Z',
      endsAt: '2026-08-01T11:00:00.000Z',
      idempotencyKey: 'sched-1',
    });
    expect(retry.ok).toBe(true);
    expect(retry.alreadyExists).toBe(true);
    expect(prisma._stores.meetingStore.length).toBe(1);
  });

  it('schedule retry after calendar-create failure does not mark Demo SCHEDULED without Calendar', async () => {
    const demo = await createDemo(prisma, {
      admin,
      title: 'Calendar fail then retry',
      contactId: 'con-ok',
      leadId: 'lead-cal-fail',
    });
    expect(demo.ok).toBe(true);

    const realCreate = prisma.crmCalendarEvent.create;
    prisma.crmCalendarEvent.create = undefined;

    const first = await scheduleDemo(prisma, {
      admin,
      demoId: demo.demo.id,
      timezone: 'UTC',
      startsAt: '2026-08-03T10:00:00.000Z',
      endsAt: '2026-08-03T11:00:00.000Z',
      idempotencyKey: 'sched-cal-fail',
    });
    expect(first.ok).toBe(false);
    expect(prisma._stores.meetingStore.length).toBe(1);
    expect(prisma._stores.meetingStore[0].status).toBe('CANCELLED');
    expect(prisma._stores.calendarStore.length).toBe(0);
    expect(prisma._stores.demoStore[0].status).not.toBe(CRM_DEMO_STATUS.SCHEDULED);
    expect(prisma._stores.demoStore[0].calendarEventId).toBeFalsy();

    prisma.crmCalendarEvent.create = realCreate;

    const retry = await scheduleDemo(prisma, {
      admin,
      demoId: demo.demo.id,
      timezone: 'UTC',
      startsAt: '2026-08-03T10:00:00.000Z',
      endsAt: '2026-08-03T11:00:00.000Z',
      idempotencyKey: 'sched-cal-fail',
    });
    expect(retry.ok).toBe(false);
    expect(retry.error).toBe('meeting_cancelled_cannot_schedule_demo');
    expect(prisma._stores.demoStore[0].status).not.toBe(CRM_DEMO_STATUS.SCHEDULED);
    expect(prisma._stores.demoStore[0].calendarEventId).toBeFalsy();
    expect(prisma._stores.calendarStore.length).toBe(0);
  });

  it('readiness blocks READY_TO_DELIVER when Meeting/presenter/Contact missing', async () => {
    const demo = await createDemo(prisma, {
      admin,
      title: 'Readiness',
    });
    expect(demo.ok).toBe(true);

    const eval1 = await evaluateDemoReadiness(prisma, {
      admin,
      demoId: demo.demo.id,
    });
    expect(eval1.ok).toBe(true);
    expect(eval1.readinessStatus).toBe(CRM_READINESS_STATUS.BLOCKED);
    expect(eval1.blockers).toEqual(
      expect.arrayContaining(['meeting_linked', 'presenter_assigned', 'primary_contact'])
    );

    // Schedule alone clears meeting/calendar but not presenter/contact
    const scheduled = await scheduleDemo(prisma, {
      admin,
      demoId: demo.demo.id,
      timezone: 'UTC',
      startsAt: '2026-08-02T10:00:00.000Z',
      endsAt: '2026-08-02T11:00:00.000Z',
    });
    expect(scheduled.ok).toBe(true);
    expect(scheduled.demo.status).toBe(CRM_DEMO_STATUS.SCHEDULED);

    const blocked = await transitionDemoStatus(prisma, {
      admin,
      demoId: demo.demo.id,
      toStatus: CRM_DEMO_STATUS.READY_TO_DELIVER,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toBe('demo_not_ready_to_deliver');
    expect(blocked.blockers).toEqual(
      expect.arrayContaining(['presenter_assigned', 'primary_contact'])
    );

    await addDemoParticipant(prisma, {
      admin,
      demoId: demo.demo.id,
      participantType: CRM_DEMO_PARTICIPANT_TYPE.ADMIN,
      participantId: admin.id,
      role: CRM_DEMO_PARTICIPANT_ROLE.PRESENTER,
    });
    await addDemoParticipant(prisma, {
      admin,
      demoId: demo.demo.id,
      participantType: CRM_DEMO_PARTICIPANT_TYPE.CONTACT,
      participantId: 'con-ok',
      role: CRM_DEMO_PARTICIPANT_ROLE.PRIMARY_CONTACT,
    });

    const eval2 = await evaluateDemoReadiness(prisma, {
      admin,
      demoId: demo.demo.id,
    });
    expect(eval2.ok).toBe(true);
    expect(eval2.blockers).toEqual([]);
    expect(
      [CRM_READINESS_STATUS.READY, CRM_READINESS_STATUS.PARTIALLY_READY].includes(
        eval2.readinessStatus
      )
    ).toBe(true);

    const ready = await transitionDemoStatus(prisma, {
      admin,
      demoId: demo.demo.id,
      toStatus: CRM_DEMO_STATUS.READY_TO_DELIVER,
    });
    expect(ready.ok).toBe(true);
    expect(ready.demo.status).toBe(CRM_DEMO_STATUS.READY_TO_DELIVER);
  });

  it('participants keep attendance UNKNOWN; RSVP never invents attendance; domain contract honest', async () => {
    const demo = await createDemo(prisma, {
      admin,
      title: 'Participants',
      contactId: 'con-ok',
    });
    const added = await addDemoParticipant(prisma, {
      admin,
      demoId: demo.demo.id,
      participantType: CRM_DEMO_PARTICIPANT_TYPE.CONTACT,
      participantId: 'con-ok',
      role: CRM_DEMO_PARTICIPANT_ROLE.PRIMARY_CONTACT,
    });
    expect(added.ok).toBe(true);
    expect(added.participant.attendanceStatus).toBe('UNKNOWN');
    expect(added.participant.rsvpStatus).toBe('PENDING');

    const removed = await removeDemoParticipant(prisma, {
      admin,
      participantRecordId: added.participant.id,
    });
    expect(removed.ok).toBe(true);

    const contract = getDemoDomainContract();
    expect(contract.demoEqualsMeeting).toBe(false);
    expect(contract.mraEisSandboxEqualsDemoEnvironment).toBe(false);
    expect(contract.inventProposalForbidden).toBe(true);
    expect(contract.inventTenantProvisionForbidden).toBe(true);
    expect(contract.inventAttendanceForbidden).toBe(true);
  });

  it('get/list demos and forbids unprivileged admin', async () => {
    const created = await createDemo(prisma, {
      admin,
      title: 'Listable',
      leadId: 'lead-l',
    });
    const got = await getDemo(prisma, { admin, demoId: created.demo.id });
    expect(got.ok).toBe(true);
    expect(got.demo.demoNumber).toBe(created.demo.demoNumber);

    const listed = await listDemos(prisma, { admin, leadId: 'lead-l' });
    expect(listed.ok).toBe(true);
    expect(listed.count).toBe(1);

    const denied = await createDemo(prisma, {
      admin: makeAdmin('noperm', {}),
      title: 'Nope',
    });
    expect(denied.ok).toBe(false);
    expect(denied.forbidden).toBe(true);
  });

  it('returns UNAVAILABLE when Demo model missing (EPERM guard)', async () => {
    const bare = {
      crmDemo: undefined,
      crmDemoRequest: undefined,
    };
    const result = await createDemo(bare, { admin, title: 'x' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('UNAVAILABLE');
  });
});
