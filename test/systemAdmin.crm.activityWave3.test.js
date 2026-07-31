/**
 * Phase 13 Wave 3 — Meetings + internal Calendar + conflicts + ICS.
 * RSVP ≠ attendance; Google/Outlook NOT_CONNECTED; fail-closed on Activity create.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CRM_ACTIVITY_TYPE,
  CRM_ACTIVITY_STATUS,
  CRM_MEETING_STATUS,
  CRM_MEETING_NUMBER_RE,
  CRM_MEETING_RSVP,
  CRM_MEETING_ATTENDANCE,
  CRM_CALENDAR_CONFLICT_POLICY,
  CRM_CALENDAR_INTEGRATION_STATUS,
  allocateMeetingNumber,
  createMeeting,
  rescheduleMeeting,
  cancelMeeting,
  recordAttendance,
  recordMeetingRsvp,
  listCalendarEvents,
  detectCalendarConflicts,
  exportIcs,
  getCalendarIntegrationStatus,
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
  const contactStore = overrides._contactStore || [
    { id: 'con-ok', contactNumber: 'CON-2026-000001', email: 'ok@example.com' },
    { id: 'con-dnc', contactNumber: 'CON-2026-000002', email: 'dnc@example.com' },
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
          completedAt: data.completedAt ?? null,
          dueAt: data.dueAt ?? null,
          outcome: data.outcome ?? null,
          title: data.title ?? null,
          timezone: data.timezone ?? null,
          idempotencyKey: data.idempotencyKey ?? null,
          ...data,
        };
        activityStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return activityStore.find((r) => r.id === where.id) || null;
        if (where.activityNumber) {
          return activityStore.find((r) => r.activityNumber === where.activityNumber) || null;
        }
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
          rsvpStatus: data.rsvpStatus || CRM_MEETING_RSVP.PENDING,
          attendanceStatus: data.attendanceStatus ?? CRM_MEETING_ATTENDANCE.UNKNOWN,
          ...data,
        };
        meetingParticipantStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) {
          return meetingParticipantStore.find((r) => r.id === where.id) || null;
        }
        return null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...meetingParticipantStore];
        if (where.meetingId) rows = rows.filter((r) => r.meetingId === where.meetingId);
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = meetingParticipantStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmMeetingRescheduleHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `mrh-${rescheduleStore.length + 1}`, ...data };
        rescheduleStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...rescheduleStore];
        if (where.meetingId) rows = rows.filter((r) => r.meetingId === where.meetingId);
        return rows;
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
        if (where.startsAtUtc?.gte && where.startsAtUtc?.lt) {
          rows = rows.filter(
            (r) =>
              new Date(r.startsAtUtc) >= new Date(where.startsAtUtc.gte) &&
              new Date(r.startsAtUtc) < new Date(where.startsAtUtc.lt)
          );
        }
        if (where.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.AND) {
                return clause.AND.every((c) => {
                  if (c.startsAtUtc?.lt) {
                    return new Date(r.startsAtUtc) < new Date(c.startsAtUtc.lt);
                  }
                  if (c.endsAtUtc?.gt) {
                    return new Date(r.endsAtUtc) > new Date(c.endsAtUtc.gt);
                  }
                  return true;
                });
              }
              return true;
            })
          );
        }
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = calendarStore.find((r) => r.id === where.id || r.meetingId === where.meetingId);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
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
    crmFollowUp: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `fu-${followUpStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          consentBlocked: data.consentBlocked === true,
          ...data,
        };
        followUpStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return followUpStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findMany: vi.fn(async () => [...followUpStore]),
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
        if (where.purpose) rows = rows.filter((r) => r.purpose === where.purpose);
        return rows;
      }),
      findFirst: vi.fn(async ({ where = {}, orderBy } = {}) => {
        let rows = [...consentStore];
        if (where.contactId) rows = rows.filter((r) => r.contactId === where.contactId);
        if (where.purpose) rows = rows.filter((r) => r.purpose === where.purpose);
        if (orderBy?.createdAt === 'desc') {
          rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        return rows[0] || null;
      }),
    },
    crmDoNotContact: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `dnc-${dncStore.length + 1}`, ...data };
        dncStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...dncStore];
        if (where.contactId) rows = rows.filter((r) => r.contactId === where.contactId);
        if (where.active === true) rows = rows.filter((r) => r.active !== false);
        return rows;
      }),
    },
    _stores: {
      seqStore,
      activityStore,
      meetingStore,
      meetingParticipantStore,
      rescheduleStore,
      calendarStore,
      followUpStore,
      timelineStore,
      consentStore,
      dncStore,
      contactStore,
    },
  };

  return prisma;
}

describe('CRM Activity Wave 3 — Meeting numbering + timezone + end-before-start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allocates MEET-YYYY-###### and creates timezone-explicit Meeting + Activity', async () => {
    const prisma = makePrisma({
      _consentStore: [
        {
          contactId: 'con-ok',
          purpose: 'SALES_CONTACT',
          status: 'GRANTED',
          source: 'explicit',
          createdAt: new Date('2026-01-01'),
        },
      ],
    });
    const admin = makeAdmin('m-1', { viewLeads: true, editLeads: true });

    const allocated = await allocateMeetingNumber(prisma, {
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(allocated.ok).toBe(true);
    expect(allocated.number).toMatch(CRM_MEETING_NUMBER_RE);

    const created = await createMeeting(prisma, {
      admin,
      title: 'Discovery call',
      subjectType: 'LEAD',
      subjectId: 'lead-1',
      contactId: 'con-ok',
      timezone: 'Africa/Blantyre',
      startsAt: '2026-08-01T08:00:00.000Z',
      endsAt: '2026-08-01T09:00:00.000Z',
      startsAtOriginal: '2026-08-01T10:00:00',
      endsAtOriginal: '2026-08-01T11:00:00',
      participants: [
        { participantType: 'CONTACT', participantId: 'con-ok', role: 'REQUIRED' },
      ],
      now: new Date('2026-07-30T12:00:00.000Z'),
    });

    expect(created.ok).toBe(true);
    expect(created.meeting.meetingNumber).toMatch(CRM_MEETING_NUMBER_RE);
    expect(created.meeting.timezone).toBe('Africa/Blantyre');
    expect(created.meeting.startsAtOriginal).toBe('2026-08-01T10:00:00');
    expect(created.meeting.status).toBe(CRM_MEETING_STATUS.SCHEDULED);
    expect(created.activity?.type).toBe(CRM_ACTIVITY_TYPE.MEETING);
    expect(created.activity?.status).toBe(CRM_ACTIVITY_STATUS.PLANNED);
    expect(created.calendarEvent?.activityId).toBe(created.activity.id);
    expect(created.calendarEvent?.meetingId).toBe(created.meeting.id);
    expect(created.integrations.google).toBe(CRM_CALENDAR_INTEGRATION_STATUS);
    expect(created.integrations.outlook).toBe(CRM_CALENDAR_INTEGRATION_STATUS);
  });

  it('blocks end-before-start and missing timezone', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const noTz = await createMeeting(prisma, {
      admin,
      title: 'No tz',
      subjectType: 'LEAD',
      subjectId: 'lead-tz',
      startsAt: '2026-08-01T08:00:00.000Z',
      endsAt: '2026-08-01T09:00:00.000Z',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(noTz.ok).toBe(false);
    expect(noTz.error).toBe('timezone_required');
    expect(prisma.crmMeeting.create).not.toHaveBeenCalled();

    const bad = await createMeeting(prisma, {
      admin,
      title: 'Inverted',
      subjectType: 'LEAD',
      subjectId: 'lead-inv',
      timezone: 'UTC',
      startsAt: '2026-08-01T10:00:00.000Z',
      endsAt: '2026-08-01T09:00:00.000Z',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(bad.ok).toBe(false);
    expect(bad.error).toBe('end_before_start');
    expect(prisma.crmMeeting.create).not.toHaveBeenCalled();
  });
});

describe('CRM Activity Wave 3 — RSVP ≠ attendance', () => {
  it('keeps RSVP ACCEPTED distinct from ATTENDED; attendance needs authorised confirmation', async () => {
    const prisma = makePrisma({
      _consentStore: [
        {
          contactId: 'con-ok',
          purpose: 'SALES_CONTACT',
          status: 'GRANTED',
          source: 'explicit',
          createdAt: new Date('2026-01-01'),
        },
      ],
    });
    const admin = makeAdmin('m-att', { viewLeads: true, editLeads: true });

    const created = await createMeeting(prisma, {
      admin,
      title: 'RSVP vs attendance',
      subjectType: 'OPPORTUNITY',
      subjectId: 'opp-1',
      contactId: 'con-ok',
      timezone: 'UTC',
      startsAt: '2026-08-02T10:00:00.000Z',
      endsAt: '2026-08-02T11:00:00.000Z',
      participants: [
        { participantType: 'CONTACT', participantId: 'con-ok', role: 'REQUIRED' },
      ],
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(created.ok).toBe(true);
    const participantId = created.participants[0].id;

    const rsvp = await recordMeetingRsvp(prisma, {
      admin,
      meetingId: created.meeting.id,
      participantId,
      rsvpStatus: CRM_MEETING_RSVP.ACCEPTED,
      now: new Date('2026-07-30T13:00:00.000Z'),
    });
    expect(rsvp.ok).toBe(true);
    expect(rsvp.participant.rsvpStatus).toBe(CRM_MEETING_RSVP.ACCEPTED);
    expect(rsvp.participant.attendanceStatus).toBe(CRM_MEETING_ATTENDANCE.UNKNOWN);
    expect(rsvp.fabricatedAttendance).toBe(false);

    const forbidden = await recordAttendance(prisma, {
      admin: makeAdmin('viewer', { viewLeads: true }),
      meetingId: created.meeting.id,
      participantId,
      attendanceStatus: CRM_MEETING_ATTENDANCE.ATTENDED,
      now: new Date('2026-08-02T12:00:00.000Z'),
    });
    expect(forbidden.ok).toBe(false);
    expect(forbidden.forbidden || forbidden.error).toBeTruthy();

    const attended = await recordAttendance(prisma, {
      admin,
      meetingId: created.meeting.id,
      participantId,
      attendanceStatus: CRM_MEETING_ATTENDANCE.ATTENDED,
      now: new Date('2026-08-02T12:00:00.000Z'),
    });
    expect(attended.ok).toBe(true);
    expect(attended.participant.attendanceStatus).toBe(CRM_MEETING_ATTENDANCE.ATTENDED);
    expect(attended.participant.rsvpStatus).toBe(CRM_MEETING_RSVP.ACCEPTED);
    expect(attended.fromRsvpAlone).toBe(false);
  });
});

describe('CRM Activity Wave 3 — conflicts + ICS + NOT_CONNECTED', () => {
  it('detects conflicts, exports ICS, and reports Google/Outlook NOT_CONNECTED', async () => {
    const prisma = makePrisma();
    const admin = superAdmin('owner-cal');

    const a = await createMeeting(prisma, {
      admin,
      title: 'Slot A',
      subjectType: 'LEAD',
      subjectId: 'lead-a',
      timezone: 'UTC',
      startsAt: '2026-08-05T09:00:00.000Z',
      endsAt: '2026-08-05T10:00:00.000Z',
      ownerAdminId: 'owner-cal',
      conflictPolicy: CRM_CALENDAR_CONFLICT_POLICY.WARN,
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(a.ok).toBe(true);

    const blocked = await createMeeting(prisma, {
      admin,
      title: 'Slot B blocked',
      subjectType: 'LEAD',
      subjectId: 'lead-b',
      timezone: 'UTC',
      startsAt: '2026-08-05T09:30:00.000Z',
      endsAt: '2026-08-05T10:30:00.000Z',
      ownerAdminId: 'owner-cal',
      conflictPolicy: CRM_CALENDAR_CONFLICT_POLICY.BLOCK,
      now: new Date('2026-07-30T12:05:00.000Z'),
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toBe('calendar_conflict_blocked');
    expect(blocked.conflicts?.length).toBeGreaterThan(0);

    const warned = await createMeeting(prisma, {
      admin,
      title: 'Slot B warn',
      subjectType: 'LEAD',
      subjectId: 'lead-b2',
      timezone: 'UTC',
      startsAt: '2026-08-05T09:30:00.000Z',
      endsAt: '2026-08-05T10:30:00.000Z',
      ownerAdminId: 'owner-cal',
      conflictPolicy: CRM_CALENDAR_CONFLICT_POLICY.WARN,
      now: new Date('2026-07-30T12:06:00.000Z'),
    });
    expect(warned.ok).toBe(true);
    expect(warned.conflicts?.length).toBeGreaterThan(0);

    const allowed = await createMeeting(prisma, {
      admin,
      title: 'Slot C reason',
      subjectType: 'LEAD',
      subjectId: 'lead-c',
      timezone: 'UTC',
      startsAt: '2026-08-05T09:45:00.000Z',
      endsAt: '2026-08-05T10:15:00.000Z',
      ownerAdminId: 'owner-cal',
      conflictPolicy: CRM_CALENDAR_CONFLICT_POLICY.ALLOW_WITH_REASON,
      conflictReason: 'Customer requested overlap',
      now: new Date('2026-07-30T12:07:00.000Z'),
    });
    expect(allowed.ok).toBe(true);
    expect(allowed.conflictReason).toBe('Customer requested overlap');

    const noReason = await createMeeting(prisma, {
      admin,
      title: 'No reason',
      subjectType: 'LEAD',
      subjectId: 'lead-d',
      timezone: 'UTC',
      startsAt: '2026-08-05T09:50:00.000Z',
      endsAt: '2026-08-05T10:20:00.000Z',
      ownerAdminId: 'owner-cal',
      conflictPolicy: CRM_CALENDAR_CONFLICT_POLICY.ALLOW_WITH_REASON,
      now: new Date('2026-07-30T12:08:00.000Z'),
    });
    expect(noReason.ok).toBe(false);
    expect(noReason.error).toBe('conflict_reason_required');

    const detected = await detectCalendarConflicts(prisma, {
      admin,
      ownerAdminId: 'owner-cal',
      startsAt: '2026-08-05T09:00:00.000Z',
      endsAt: '2026-08-05T10:00:00.000Z',
    });
    expect(detected.ok).toBe(true);
    expect(detected.conflicts.length).toBeGreaterThan(0);

    const listed = await listCalendarEvents(prisma, {
      admin,
      view: 'day',
      date: '2026-08-05',
      timezone: 'UTC',
      ownerAdminId: 'owner-cal',
    });
    expect(listed.ok).toBe(true);
    expect(listed.events.length).toBeGreaterThan(0);
    expect(listed.view).toBe('day');
    expect(listed.workingHours).toBeTruthy();

    const ics = await exportIcs(prisma, {
      admin,
      eventIds: listed.events.map((e) => e.id),
      ownerAdminId: 'owner-cal',
    });
    expect(ics.ok).toBe(true);
    expect(ics.ics).toContain('BEGIN:VCALENDAR');
    expect(ics.ics).toContain('BEGIN:VEVENT');
    expect(ics.ics).toContain('END:VCALENDAR');
    expect(ics.externalSync).toBe(false);

    const status = getCalendarIntegrationStatus();
    expect(status.google).toBe(CRM_CALENDAR_INTEGRATION_STATUS);
    expect(status.outlook).toBe(CRM_CALENDAR_INTEGRATION_STATUS);
    expect(status.externalEventsFabricated).toBe(false);
  });

  it('hides private details in availability mode', async () => {
    const prisma = makePrisma();
    const admin = superAdmin('priv-1');

    await createMeeting(prisma, {
      admin,
      title: 'Secret pipeline review',
      subjectType: 'LEAD',
      subjectId: 'lead-p',
      timezone: 'UTC',
      startsAt: '2026-08-06T14:00:00.000Z',
      endsAt: '2026-08-06T15:00:00.000Z',
      visibility: 'PRIVATE',
      ownerAdminId: 'priv-1',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });

    const avail = await listCalendarEvents(prisma, {
      admin,
      view: 'day',
      date: '2026-08-06',
      timezone: 'UTC',
      ownerAdminId: 'priv-1',
      availabilityOnly: true,
    });
    expect(avail.ok).toBe(true);
    expect(avail.events[0].title).not.toContain('Secret');
    expect(avail.events[0].busy).toBe(true);
    expect(avail.events[0].privateDetailsHidden).toBe(true);
  });
});

describe('CRM Activity Wave 3 — reschedule / cancel / fail-closed', () => {
  it('records reschedule history, cancels with Follow-Up hook, fail-closes on Activity failure', async () => {
    const prisma = makePrisma();
    const admin = makeAdmin('m-rs', { viewLeads: true, editLeads: true });

    const created = await createMeeting(prisma, {
      admin,
      title: 'Reschedule me',
      subjectType: 'LEAD',
      subjectId: 'lead-rs',
      timezone: 'Africa/Blantyre',
      startsAt: '2026-08-10T08:00:00.000Z',
      endsAt: '2026-08-10T09:00:00.000Z',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(created.ok).toBe(true);

    const moved = await rescheduleMeeting(prisma, {
      admin,
      meetingId: created.meeting.id,
      timezone: 'Africa/Blantyre',
      startsAt: '2026-08-11T08:00:00.000Z',
      endsAt: '2026-08-11T09:00:00.000Z',
      reason: 'Prospect asked for Tuesday',
      now: new Date('2026-07-30T13:00:00.000Z'),
    });
    expect(moved.ok).toBe(true);
    expect(moved.meeting.status).toBe(CRM_MEETING_STATUS.RESCHEDULED);
    expect(moved.history?.length).toBeGreaterThan(0);

    const cancelled = await cancelMeeting(prisma, {
      admin,
      meetingId: created.meeting.id,
      reason: 'Prospect cancelled',
      createFollowUp: true,
      now: new Date('2026-07-30T14:00:00.000Z'),
    });
    expect(cancelled.ok).toBe(true);
    expect(cancelled.meeting.status).toBe(CRM_MEETING_STATUS.CANCELLED);
    expect(cancelled.followUp).toBeTruthy();
    expect(cancelled.followUp.autoExecuted).toBe(false);

    const broken = makePrisma();
    const realCreate = broken.crmNumberSeq.create;
    broken.crmNumberSeq.create = vi.fn(async ({ data }) => {
      if (data.prefix === 'ACT') {
        const err = Object.assign(new Error('fail'), { code: 'P2002' });
        throw err;
      }
      return realCreate({ data });
    });
    broken.crmNumberSeq.findUnique = vi.fn(async ({ where = {} } = {}) => {
      const key = where.prefix_year || where;
      if (key.prefix === 'ACT') return { prefix: 'ACT', year: key.year, lastIssued: 1 };
      return null;
    });
    broken.crmNumberSeq.updateMany = vi.fn(async () => ({ count: 0 }));

    const orphan = await createMeeting(broken, {
      admin,
      title: 'Must not orphan meeting',
      subjectType: 'LEAD',
      subjectId: 'lead-orphan',
      timezone: 'UTC',
      startsAt: '2026-08-12T08:00:00.000Z',
      endsAt: '2026-08-12T09:00:00.000Z',
      now: new Date('2026-07-30T15:00:00.000Z'),
    });
    expect(orphan.ok).toBe(false);
    expect(orphan.error).toBeTruthy();
    expect(broken.crmMeeting.create).not.toHaveBeenCalled();
    expect(broken.crmCalendarEvent.create).not.toHaveBeenCalled();
  });

  it('blocks outbound invitation when Contact gate fails (DNC / missing contact)', async () => {
    const prisma = makePrisma({
      _dncStore: [
        {
          contactId: 'con-dnc',
          flag: 'DO_NOT_EMAIL',
          active: true,
          createdAt: new Date('2026-01-01'),
        },
      ],
    });
    const admin = superAdmin();

    const noContact = await createMeeting(prisma, {
      admin,
      title: 'Invite without contact',
      subjectType: 'LEAD',
      subjectId: 'lead-nc',
      timezone: 'UTC',
      startsAt: '2026-08-13T08:00:00.000Z',
      endsAt: '2026-08-13T09:00:00.000Z',
      sendInvitations: true,
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(noContact.ok).toBe(false);
    expect(noContact.error).toBe('CONTACT_REQUIRED');

    const dnc = await createMeeting(prisma, {
      admin,
      title: 'Invite DNC',
      subjectType: 'LEAD',
      subjectId: 'lead-dnc',
      contactId: 'con-dnc',
      timezone: 'UTC',
      startsAt: '2026-08-13T10:00:00.000Z',
      endsAt: '2026-08-13T11:00:00.000Z',
      sendInvitations: true,
      participants: [
        { participantType: 'CONTACT', participantId: 'con-dnc', role: 'REQUIRED' },
      ],
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(dnc.ok).toBe(true);
    expect(dnc.meeting.consentBlocked).toBe(true);
    expect(dnc.participants[0].invitationStatus).toBe('BLOCKED_BY_CONSENT');
    expect(dnc.invitationSent).toBe(false);
  });
});
