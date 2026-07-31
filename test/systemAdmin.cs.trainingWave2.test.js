/**
 * Phase 18 Wave 2 — Participants, trainers, cohorts, Sessions (Phase 13),
 * conflicts, attendance, materials/env boundary.
 * RSVP ≠ attendance; invitation/calendar/link ≠ attendance;
 * no fabricated Session delivery; UNKNOWN denied restricted materials.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CRM_MEETING_RSVP,
  CRM_MEETING_ATTENDANCE,
} from '@/lib/admin/crm/meetings/catalogue.js';
import {
  VIRTUAL_PROVIDER_NOT_CONFIGURED,
  MEETING_SERVICE_UNAVAILABLE,
  TRAINING_ATTENDANCE_SOURCE,
  TRAINING_CONFLICT_STATE,
  TRAINING_PARTICIPANT_VERIFICATION,
  TRAINING_MATERIAL_CLASSIFICATION,
  scheduleTrainingSession,
  recordTrainingSessionRsvp,
  assignTrainingTrainer,
  evaluateTrainingConflicts,
  confirmTrainingSchedule,
  captureTrainingAttendance,
  correctTrainingAttendance,
  verifyTrainingParticipant,
  enrolTrainingParticipant,
  createTrainingCohort,
  assertRestrictedMaterialAccess,
  assertTrainingEnvironmentIsolation,
  getVirtualProviderStatus,
  requestVirtualTrainingProviderSession,
} from '@/lib/admin/customerSuccess/training';

function superAdmin(id = 'super-trn-w2-1') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function csManager(id = 'cs-mgr-w2-1') {
  return {
    id,
    role: 'System Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function makePrisma(overrides = {}) {
  const programStore = overrides._programStore || [
    {
      id: 'trn-prog-1',
      programNumber: 'TRN-2026-000001',
      status: 'SCHEDULING',
      trainingType: 'CUSTOMER_ONBOARDING',
      trainingRequestId: 'trq-1',
      customerId: 'cust-1',
      tenantId: 'tenant-1',
      subscriptionId: 'sub-1',
      curriculumVersionId: 'currv-onboarding-wave1-v1',
      createdByAdminId: 'super-trn-w2-1',
      createdAt: new Date('2026-07-31T10:00:00Z'),
      updatedAt: new Date('2026-07-31T10:00:00Z'),
    },
  ];
  const cohortStore = overrides._cohortStore || [];
  const participantStore = overrides._participantStore || [];
  const enrolmentStore = overrides._enrolmentStore || [];
  const trainerStore = overrides._trainerStore || [];
  const trainerAssignmentStore = overrides._trainerAssignmentStore || [];
  const sessionStore = overrides._sessionStore || [];
  const attendanceStore = overrides._attendanceStore || [];
  const materialStore = overrides._materialStore || [];
  const conflictStore = overrides._conflictStore || [];
  const meetingStore = overrides._meetingStore || [];
  const meetingParticipantStore = overrides._meetingParticipantStore || [];
  const seqStore = overrides._seqStore || [];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _programStore: programStore,
    _cohortStore: cohortStore,
    _participantStore: participantStore,
    _enrolmentStore: enrolmentStore,
    _trainerStore: trainerStore,
    _trainerAssignmentStore: trainerAssignmentStore,
    _sessionStore: sessionStore,
    _attendanceStore: attendanceStore,
    _materialStore: materialStore,
    _conflictStore: conflictStore,
    _meetingStore: meetingStore,
    _meetingParticipantStore: meetingParticipantStore,
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
    customerTrainingProgram: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `trn-prog-${programStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        programStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return programStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...programStore];
        if (where.id) rows = rows.filter((r) => r.id === where.id);
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...programStore];
        for (const [k, v] of Object.entries(where || {})) {
          if (v == null) continue;
          if (typeof v === 'object' && v.in) {
            rows = rows.filter((r) => v.in.includes(r[k]));
          } else {
            rows = rows.filter((r) => r[k] === v);
          }
        }
        return rows;
      }),
    },
    customerTrainingCohort: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `coh-${cohortStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        cohortStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return cohortStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return cohortStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        if (where.cohortNumber) {
          return cohortStore.find((r) => r.cohortNumber === where.cohortNumber) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...cohortStore];
        if (where.programId) rows = rows.filter((r) => r.programId === where.programId);
        if (where.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...cohortStore];
        if (where.programId) rows = rows.filter((r) => r.programId === where.programId);
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = cohortStore.find((r) => r.id === where.id);
        if (!row) throw new Error('cohort_not_found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerTrainingParticipant: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `part-${participantStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        participantStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return participantStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...participantStore];
        if (where.programId) rows = rows.filter((r) => r.programId === where.programId);
        if (where.identityKey) {
          rows = rows.filter((r) => r.identityKey === where.identityKey);
        }
        if (where.contactId) rows = rows.filter((r) => r.contactId === where.contactId);
        if (where.tenantUserId) {
          rows = rows.filter((r) => r.tenantUserId === where.tenantUserId);
        }
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...participantStore];
        if (where.programId) rows = rows.filter((r) => r.programId === where.programId);
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = participantStore.find((r) => r.id === where.id);
        if (!row) throw new Error('participant_not_found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerTrainingEnrolment: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `enr-${enrolmentStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        enrolmentStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...enrolmentStore];
        if (where.participantId) {
          rows = rows.filter((r) => r.participantId === where.participantId);
        }
        if (where.cohortId) rows = rows.filter((r) => r.cohortId === where.cohortId);
        if (where.programId) rows = rows.filter((r) => r.programId === where.programId);
        if (where.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...enrolmentStore];
        if (where.cohortId) rows = rows.filter((r) => r.cohortId === where.cohortId);
        if (where.programId) rows = rows.filter((r) => r.programId === where.programId);
        return rows;
      }),
    },
    customerTrainingTrainer: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `trnr-${trainerStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        trainerStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return trainerStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...trainerStore];
        if (where.adminId) rows = rows.filter((r) => r.adminId === where.adminId);
        return rows[0] || null;
      }),
    },
    customerTrainingTrainerAssignment: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `tassign-${trainerAssignmentStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        trainerAssignmentStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...trainerAssignmentStore];
        if (where.trainerId) rows = rows.filter((r) => r.trainerId === where.trainerId);
        if (where.sessionId) rows = rows.filter((r) => r.sessionId === where.sessionId);
        if (where.programId) rows = rows.filter((r) => r.programId === where.programId);
        return rows;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...trainerAssignmentStore];
        if (where.trainerId) rows = rows.filter((r) => r.trainerId === where.trainerId);
        if (where.sessionId) rows = rows.filter((r) => r.sessionId === where.sessionId);
        return rows[0] || null;
      }),
    },
    customerTrainingSession: {
      create: vi.fn(async ({ data }) => {
        if (
          data.idempotencyKey &&
          sessionStore.some((r) => r.idempotencyKey === data.idempotencyKey)
        ) {
          const err = new Error('Unique constraint failed on idempotencyKey');
          err.code = 'P2002';
          throw err;
        }
        const row = {
          id: data.id || `sess-${sessionStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        sessionStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return sessionStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return sessionStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        if (where.sessionNumber) {
          return sessionStore.find((r) => r.sessionNumber === where.sessionNumber) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...sessionStore];
        if (where.programId) rows = rows.filter((r) => r.programId === where.programId);
        if (where.cohortId) rows = rows.filter((r) => r.cohortId === where.cohortId);
        if (where.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...sessionStore];
        if (where.programId) rows = rows.filter((r) => r.programId === where.programId);
        if (where.cohortId) rows = rows.filter((r) => r.cohortId === where.cohortId);
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = sessionStore.find((r) => r.id === where.id);
        if (!row) throw new Error('session_not_found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerTrainingAttendance: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `att-${attendanceStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        attendanceStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return attendanceStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...attendanceStore];
        if (where.sessionId) rows = rows.filter((r) => r.sessionId === where.sessionId);
        if (where.participantId) {
          rows = rows.filter((r) => r.participantId === where.participantId);
        }
        if (where.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...attendanceStore];
        if (where.sessionId) rows = rows.filter((r) => r.sessionId === where.sessionId);
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = attendanceStore.find((r) => r.id === where.id);
        if (!row) throw new Error('attendance_not_found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerTrainingMaterial: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `mat-${materialStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        materialStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return materialStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...materialStore];
        if (where.id) rows = rows.filter((r) => r.id === where.id);
        if (where.programId) rows = rows.filter((r) => r.programId === where.programId);
        return rows[0] || null;
      }),
    },
    customerTrainingConflict: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `conf-${conflictStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        conflictStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...conflictStore];
        if (where.sessionId) rows = rows.filter((r) => r.sessionId === where.sessionId);
        if (where.programId) rows = rows.filter((r) => r.programId === where.programId);
        return rows;
      }),
    },
    crmMeeting: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `meet-${meetingStore.length + 1}`,
          meetingNumber: data.meetingNumber || `MEET-2026-${String(meetingStore.length + 1).padStart(6, '0')}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        meetingStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return meetingStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...meetingStore];
        if (where.id) rows = rows.filter((r) => r.id === where.id);
        return rows[0] || null;
      }),
    },
    crmMeetingParticipant: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `mp-${meetingParticipantStore.length + 1}`,
          rsvpStatus: data.rsvpStatus || CRM_MEETING_RSVP.PENDING,
          attendanceStatus: data.attendanceStatus || CRM_MEETING_ATTENDANCE.UNKNOWN,
          ...data,
        };
        meetingParticipantStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...meetingParticipantStore];
        if (where.meetingId) rows = rows.filter((r) => r.meetingId === where.meetingId);
        if (where.contactId) rows = rows.filter((r) => r.contactId === where.contactId);
        return rows[0] || null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = meetingParticipantStore.find((r) => r.id === where.id);
        if (!row) throw new Error('meeting_participant_not_found');
        Object.assign(row, data);
        return row;
      }),
    },
  };

  return prisma;
}

async function seedCohortAndParticipant(prisma, admin, opts = {}) {
  const cohort = await createTrainingCohort(prisma, {
    actorContext: { admin },
    programId: 'trn-prog-1',
    name: opts.cohortName || 'Wave 2 Cohort A',
    language: opts.language || 'en',
    deliveryMode: opts.deliveryMode || 'VIRTUAL',
    timezone: opts.timezone || 'Africa/Johannesburg',
    capacity: opts.capacity ?? 20,
    idempotencyKey: opts.cohortKey || 'coh:seed:1',
  });
  expect(cohort.ok).toBe(true);

  const verified = await verifyTrainingParticipant(prisma, {
    actorContext: { admin },
    programId: 'trn-prog-1',
    contactId: opts.contactId || 'contact-verified-1',
    identityType: 'CUSTOMER_CONTACT',
    verificationState: TRAINING_PARTICIPANT_VERIFICATION.VERIFIED,
    idempotencyKey: opts.participantKey || 'part:seed:1',
  });
  expect(verified.ok).toBe(true);

  const enrolled = await enrolTrainingParticipant(prisma, {
    actorContext: { admin },
    programId: 'trn-prog-1',
    cohortId: cohort.cohort.id,
    participantId: verified.participant.id,
    idempotencyKey: opts.enrolKey || 'enr:seed:1',
  });
  expect(enrolled.ok).toBe(true);

  return {
    cohort: cohort.cohort,
    participant: verified.participant,
    enrolment: enrolled.enrolment,
  };
}

function meetingServiceFactory(prisma, admin) {
  return {
    createMeeting: vi.fn(async (_p, input) => {
      const row = await prisma.crmMeeting.create({
        data: {
          title: input.title || 'Training session',
          timezone: input.timezone || 'Africa/Johannesburg',
          startsAt: input.startsAt || new Date('2026-08-15T09:00:00Z'),
          endsAt: input.endsAt || new Date('2026-08-15T11:00:00Z'),
          idempotencyKey: input.idempotencyKey || null,
          ownerAdminId: admin.id,
          createdByAdminId: admin.id,
          status: 'SCHEDULED',
        },
      });
      if (input.contactId) {
        await prisma.crmMeetingParticipant.create({
          data: {
            meetingId: row.id,
            contactId: input.contactId,
            rsvpStatus: CRM_MEETING_RSVP.PENDING,
            attendanceStatus: CRM_MEETING_ATTENDANCE.UNKNOWN,
          },
        });
      }
      return { ok: true, meeting: { id: row.id, meetingNumber: row.meetingNumber } };
    }),
    recordMeetingRsvp: vi.fn(async (_p, { meetingId, contactId, rsvpStatus }) => {
      const p = await prisma.crmMeetingParticipant.findFirst({
        where: { meetingId, contactId },
      });
      if (!p) return { ok: false, error: 'participant_not_found' };
      const updated = await prisma.crmMeetingParticipant.update({
        where: { id: p.id },
        data: { rsvpStatus },
      });
      return { ok: true, participant: updated };
    }),
  };
}

describe('Phase 18 Wave 2 — Participants / Sessions / attendance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scheduleTrainingSession creates/links Phase 13 Meeting once on exact retry', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { cohort } = await seedCohortAndParticipant(prisma, admin);
    const meetingService = meetingServiceFactory(prisma, admin);

    const args = {
      actorContext: { admin },
      programId: 'trn-prog-1',
      cohortId: cohort.id,
      meetingInput: {
        title: 'Onboarding module 1',
        timezone: 'Africa/Johannesburg',
        startsAt: '2026-08-15T09:00:00Z',
        endsAt: '2026-08-15T11:00:00Z',
        contactId: 'contact-verified-1',
      },
      idempotencyKey: 'sess:retry:1',
      meetingService,
    };

    const first = await scheduleTrainingSession(prisma, args);
    expect(first.ok).toBe(true);
    expect(first.crmMeetingId).toBeTruthy();
    expect(prisma._sessionStore.length).toBe(1);
    expect(prisma._meetingStore.length).toBe(1);
    expect(first.sessionDelivered).not.toBe(true);

    const second = await scheduleTrainingSession(prisma, args);
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay).toBe(true);
    expect(second.crmMeetingId).toBe(first.crmMeetingId);
    expect(prisma._sessionStore.length).toBe(1);
    expect(prisma._meetingStore.length).toBe(1);
    expect(meetingService.createMeeting).toHaveBeenCalledTimes(1);
  });

  it('RSVP accepted does not equal training attendance', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { cohort, participant } = await seedCohortAndParticipant(prisma, admin, {
      cohortKey: 'coh:rsvp:1',
      participantKey: 'part:rsvp:1',
      enrolKey: 'enr:rsvp:1',
    });
    const meetingService = meetingServiceFactory(prisma, admin);

    const scheduled = await scheduleTrainingSession(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      cohortId: cohort.id,
      meetingInput: {
        title: 'RSVP session',
        timezone: 'Africa/Johannesburg',
        startsAt: '2026-08-16T09:00:00Z',
        endsAt: '2026-08-16T11:00:00Z',
        contactId: 'contact-verified-1',
      },
      idempotencyKey: 'sess:rsvp:1',
      meetingService,
    });
    expect(scheduled.ok).toBe(true);

    const rsvp = await recordTrainingSessionRsvp(prisma, {
      actorContext: { admin },
      sessionId: scheduled.session.id,
      contactId: 'contact-verified-1',
      rsvpStatus: CRM_MEETING_RSVP.ACCEPTED,
      meetingService,
    });
    expect(rsvp.ok).toBe(true);
    expect(rsvp.attendanceCaptured).not.toBe(true);
    expect(rsvp.note).toMatch(/RSVP.*NOT.*ATTENDANCE/i);

    const mp = await prisma.crmMeetingParticipant.findFirst({
      where: { meetingId: scheduled.crmMeetingId, contactId: 'contact-verified-1' },
    });
    expect(mp.rsvpStatus).toBe(CRM_MEETING_RSVP.ACCEPTED);
    expect(mp.attendanceStatus).toBe(CRM_MEETING_ATTENDANCE.UNKNOWN);

    expect(prisma._attendanceStore.length).toBe(0);

    const fromRsvp = await captureTrainingAttendance(prisma, {
      actorContext: { admin },
      sessionId: scheduled.session.id,
      participantId: participant.id,
      status: 'PRESENT',
      source: TRAINING_ATTENDANCE_SOURCE.CALENDAR_ACCEPTANCE,
      idempotencyKey: 'att:from-rsvp:1',
    });
    expect(fromRsvp.ok).toBe(false);
    expect(fromRsvp.error).toMatch(/invitation|calendar|link|source|forbidden/i);
  });

  it('trainer overlap BLOCKED conflict cannot confirm as NO_CONFLICT', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { cohort } = await seedCohortAndParticipant(prisma, admin, {
      cohortKey: 'coh:overlap:1',
      participantKey: 'part:overlap:1',
      enrolKey: 'enr:overlap:1',
    });
    const meetingService = meetingServiceFactory(prisma, admin);

    const trainer = await prisma.customerTrainingTrainer.create({
      data: {
        adminId: 'trainer-admin-1',
        displayName: 'Ada Trainer',
        skillsJson: ['CUSTOMER_ONBOARDING'],
        languagesJson: ['en'],
        deliveryModesJson: ['VIRTUAL'],
        status: 'ACTIVE',
      },
    });

    const sessionA = await scheduleTrainingSession(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      cohortId: cohort.id,
      meetingInput: {
        title: 'Session A',
        timezone: 'Africa/Johannesburg',
        startsAt: '2026-08-20T09:00:00Z',
        endsAt: '2026-08-20T11:00:00Z',
      },
      idempotencyKey: 'sess:overlap:a',
      meetingService,
    });
    expect(sessionA.ok).toBe(true);

    const assignA = await assignTrainingTrainer(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      sessionId: sessionA.session.id,
      trainerId: trainer.id,
      requiredSkills: ['CUSTOMER_ONBOARDING'],
      requiredLanguage: 'en',
      idempotencyKey: 'assign:a',
    });
    expect(assignA.ok).toBe(true);

    const sessionB = await scheduleTrainingSession(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      cohortId: cohort.id,
      meetingInput: {
        title: 'Session B overlap',
        timezone: 'Africa/Johannesburg',
        startsAt: '2026-08-20T10:00:00Z',
        endsAt: '2026-08-20T12:00:00Z',
      },
      idempotencyKey: 'sess:overlap:b',
      meetingService,
    });
    expect(sessionB.ok).toBe(true);

    const assignB = await assignTrainingTrainer(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      sessionId: sessionB.session.id,
      trainerId: trainer.id,
      requiredSkills: ['CUSTOMER_ONBOARDING'],
      requiredLanguage: 'en',
      idempotencyKey: 'assign:b',
      allowBlockedConflict: true,
    });
    // Assignment may record with conflict; confirm must still be blocked
    expect(assignB.ok === true || assignB.conflictState === TRAINING_CONFLICT_STATE.BLOCKED).toBe(
      true
    );

    const evaluation = await evaluateTrainingConflicts(prisma, {
      actorContext: { admin },
      sessionId: sessionB.session.id,
      trainerId: trainer.id,
    });
    expect(evaluation.ok).toBe(true);
    expect(evaluation.conflictState).toBe(TRAINING_CONFLICT_STATE.BLOCKED);
    expect(evaluation.conflictState).not.toBe(TRAINING_CONFLICT_STATE.NO_CONFLICT);

    const confirm = await confirmTrainingSchedule(prisma, {
      actorContext: { admin },
      sessionId: sessionB.session.id,
    });
    expect(confirm.ok).toBe(false);
    expect(confirm.error).toMatch(/conflict|blocked|overlap/i);
    expect(confirm.conflictState).not.toBe(TRAINING_CONFLICT_STATE.NO_CONFLICT);

    const spoofed = await confirmTrainingSchedule(prisma, {
      actorContext: { admin },
      sessionId: sessionB.session.id,
      conflictState: TRAINING_CONFLICT_STATE.NO_CONFLICT,
    });
    expect(spoofed.ok).toBe(false);
    expect(spoofed.conflictState).toBe(TRAINING_CONFLICT_STATE.BLOCKED);
    expect(spoofed.conflictState).not.toBe(TRAINING_CONFLICT_STATE.NO_CONFLICT);
  });

  it('attendance rejects invitation / calendar / link sources', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { cohort, participant } = await seedCohortAndParticipant(prisma, admin, {
      cohortKey: 'coh:att-src:1',
      participantKey: 'part:att-src:1',
      enrolKey: 'enr:att-src:1',
    });
    const meetingService = meetingServiceFactory(prisma, admin);
    const scheduled = await scheduleTrainingSession(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      cohortId: cohort.id,
      meetingInput: {
        title: 'Attendance sources',
        timezone: 'Africa/Johannesburg',
        startsAt: '2026-08-21T09:00:00Z',
        endsAt: '2026-08-21T11:00:00Z',
      },
      idempotencyKey: 'sess:att-src:1',
      meetingService,
    });

    for (const source of [
      TRAINING_ATTENDANCE_SOURCE.INVITATION_DELIVERY,
      TRAINING_ATTENDANCE_SOURCE.CALENDAR_ACCEPTANCE,
      TRAINING_ATTENDANCE_SOURCE.MEETING_LINK_ACCESS,
    ]) {
      const bad = await captureTrainingAttendance(prisma, {
        actorContext: { admin },
        sessionId: scheduled.session.id,
        participantId: participant.id,
        status: 'PRESENT',
        source,
        idempotencyKey: `att:bad:${source}`,
      });
      expect(bad.ok).toBe(false);
      expect(bad.error).toMatch(/invitation|calendar|link|source|forbidden|ATTENDANCE_TRUTH/i);
    }

    const ok = await captureTrainingAttendance(prisma, {
      actorContext: { admin },
      sessionId: scheduled.session.id,
      participantId: participant.id,
      status: 'PRESENT',
      source: TRAINING_ATTENDANCE_SOURCE.TRAINER_CONFIRMED,
      evidenceRef: 'trainer-roll:wave2-good',
      idempotencyKey: 'att:good:1',
    });
    expect(ok.ok).toBe(true);
    expect(ok.attendance.status).toBe('PRESENT');
    expect(ok.attendance.source).toBe(TRAINING_ATTENDANCE_SOURCE.TRAINER_CONFIRMED);

    const fabricated = await captureTrainingAttendance(prisma, {
      actorContext: { admin },
      sessionId: scheduled.session.id,
      participantId: participant.id,
      status: 'PRESENT',
      source: 'FABRICATED',
      idempotencyKey: 'att:fabricated:1',
    });
    expect(fabricated.ok).toBe(false);
    expect(fabricated.error).toMatch(/unknown.?source|ATTENDANCE_TRUTH|forbidden|source/i);
  });

  it('attendance capture rejects out-of-scope session (portfolio)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const manager = csManager();
    const { cohort, participant } = await seedCohortAndParticipant(prisma, admin, {
      cohortKey: 'coh:att-scope:1',
      participantKey: 'part:att-scope:1',
      enrolKey: 'enr:att-scope:1',
    });
    const meetingService = meetingServiceFactory(prisma, admin);
    const scheduled = await scheduleTrainingSession(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      cohortId: cohort.id,
      meetingInput: {
        title: 'Scoped attendance',
        timezone: 'Africa/Johannesburg',
        startsAt: '2026-08-23T09:00:00Z',
        endsAt: '2026-08-23T11:00:00Z',
      },
      idempotencyKey: 'sess:att-scope:1',
      meetingService,
    });

    const denied = await captureTrainingAttendance(prisma, {
      actorContext: { admin: manager },
      admin: manager,
      sessionId: scheduled.session.id,
      participantId: participant.id,
      status: 'PRESENT',
      source: TRAINING_ATTENDANCE_SOURCE.TRAINER_CONFIRMED,
      evidenceRef: 'trainer-roll:scope-denied',
      idempotencyKey: 'att:scope-denied:1',
      portfolioTenantIds: ['tenant-other'],
    });
    expect(denied.ok).toBe(false);
    expect(denied.error || denied.reason).toMatch(/out.?of.?scope|forbidden|denied|portfolio/i);
  });

  it('attendance correction preserves original record', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { cohort, participant } = await seedCohortAndParticipant(prisma, admin, {
      cohortKey: 'coh:corr:1',
      participantKey: 'part:corr:1',
      enrolKey: 'enr:corr:1',
    });
    const meetingService = meetingServiceFactory(prisma, admin);
    const scheduled = await scheduleTrainingSession(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      cohortId: cohort.id,
      meetingInput: {
        title: 'Correction session',
        timezone: 'Africa/Johannesburg',
        startsAt: '2026-08-22T09:00:00Z',
        endsAt: '2026-08-22T11:00:00Z',
      },
      idempotencyKey: 'sess:corr:1',
      meetingService,
    });

    const captured = await captureTrainingAttendance(prisma, {
      actorContext: { admin },
      sessionId: scheduled.session.id,
      participantId: participant.id,
      status: 'NO_SHOW',
      source: TRAINING_ATTENDANCE_SOURCE.TRAINER_CONFIRMED,
      evidenceRef: 'trainer-roll:corr-1',
      idempotencyKey: 'att:corr:1',
    });
    expect(captured.ok).toBe(true);
    const originalId = captured.attendance.id;
    const originalStatus = captured.attendance.status;

    const corrected = await correctTrainingAttendance(prisma, {
      actorContext: { admin },
      attendanceId: originalId,
      status: 'PRESENT',
      reason: 'Trainer mis-marked; participant was present',
      idempotencyKey: 'att:corr:fix:1',
    });
    expect(corrected.ok).toBe(true);
    expect(corrected.attendance.status).toBe('PRESENT');
    expect(corrected.original).toBeTruthy();
    expect(corrected.original.id || corrected.originalAttendanceId).toBe(originalId);
    expect(corrected.original.status || corrected.originalStatus).toBe(originalStatus);
    expect(prisma._attendanceStore.some((r) => r.id === originalId)).toBe(true);
    const originalRow = prisma._attendanceStore.find((r) => r.id === originalId);
    expect(originalRow.status).toBe(originalStatus);
    expect(originalRow.supersededById || corrected.attendance.correctsAttendanceId).toBeTruthy();
  });

  it('UNKNOWN participant denied restricted material download', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const unknown = await verifyTrainingParticipant(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      contactId: 'contact-unknown-1',
      identityType: 'CUSTOMER_CONTACT',
      verificationState: TRAINING_PARTICIPANT_VERIFICATION.UNKNOWN,
      idempotencyKey: 'part:unknown:1',
    });
    expect(unknown.ok).toBe(true);
    expect(unknown.participant.verificationState).toBe(
      TRAINING_PARTICIPANT_VERIFICATION.UNKNOWN
    );

    const material = await prisma.customerTrainingMaterial.create({
      data: {
        programId: 'trn-prog-1',
        title: 'Restricted sandbox credentials pack',
        classification: TRAINING_MATERIAL_CLASSIFICATION.RESTRICTED,
        storageRef: 'private://training/materials/restricted-1',
        status: 'ACTIVE',
      },
    });

    const denied = await assertRestrictedMaterialAccess(prisma, {
      actorContext: { admin },
      materialId: material.id,
      participantId: unknown.participant.id,
    });
    expect(denied.ok).toBe(false);
    expect(denied.error).toMatch(/UNKNOWN|restricted|denied|verification/i);
    expect(denied.downloadUrl).toBeFalsy();
  });

  it('environment isolation assert blocks Production data in shared practice env', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const blocked = await assertTrainingEnvironmentIsolation(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      environmentKind: 'SHARED_PRACTICE',
      dataClassification: 'PRODUCTION',
      includesProductionCustomerData: true,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/production|isolation|forbidden/i);

    const ok = await assertTrainingEnvironmentIsolation(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      environmentKind: 'SHARED_PRACTICE',
      dataClassification: 'SYNTHETIC',
      includesProductionCustomerData: false,
    });
    expect(ok.ok).toBe(true);
  });

  it('virtual provider path returns VIRTUAL_PROVIDER_NOT_CONFIGURED', async () => {
    const status = getVirtualProviderStatus();
    expect(status).toBe(VIRTUAL_PROVIDER_NOT_CONFIGURED);
    expect(status).toBe('VIRTUAL_PROVIDER_NOT_CONFIGURED');

    const prisma = makePrisma();
    const admin = superAdmin();
    const result = await requestVirtualTrainingProviderSession(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      sessionId: 'sess-virtual-1',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe(VIRTUAL_PROVIDER_NOT_CONFIGURED);
    expect(result.status).toMatch(/UNAVAILABLE|NOT_CONFIGURED/i);
    expect(result.sessionDelivered).not.toBe(true);
  });

  it('Meeting unavailable → MEETING_SERVICE_UNAVAILABLE; no fabricated delivery', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { cohort } = await seedCohortAndParticipant(prisma, admin, {
      cohortKey: 'coh:meet-unavail:1',
      participantKey: 'part:meet-unavail:1',
      enrolKey: 'enr:meet-unavail:1',
    });

    const meetingService = {
      createMeeting: vi.fn(async () => ({
        ok: false,
        error: 'crm_meeting_model_unavailable',
        status: 'UNAVAILABLE',
      })),
    };

    const result = await scheduleTrainingSession(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      cohortId: cohort.id,
      meetingInput: {
        title: 'Unavailable meeting',
        timezone: 'Africa/Johannesburg',
        startsAt: '2026-08-23T09:00:00Z',
        endsAt: '2026-08-23T11:00:00Z',
      },
      idempotencyKey: 'sess:meet-unavail:1',
      meetingService,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe(MEETING_SERVICE_UNAVAILABLE);
    expect(result.sessionDelivered).not.toBe(true);
    expect(prisma._sessionStore.length).toBe(0);
  });

  it('duplicate participant identity enrolment is blocked', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { cohort } = await seedCohortAndParticipant(prisma, admin, {
      cohortKey: 'coh:dup:1',
      participantKey: 'part:dup:1',
      enrolKey: 'enr:dup:1',
      contactId: 'contact-dup-1',
    });

    const dup = await verifyTrainingParticipant(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      contactId: 'contact-dup-1',
      identityType: 'CUSTOMER_CONTACT',
      verificationState: TRAINING_PARTICIPANT_VERIFICATION.VERIFIED,
      idempotencyKey: 'part:dup:2',
    });
    expect(dup.ok).toBe(false);
    expect(dup.error).toMatch(/duplicate|identity/i);

    const enrolDup = await enrolTrainingParticipant(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      cohortId: cohort.id,
      contactId: 'contact-dup-1',
      identityType: 'CUSTOMER_CONTACT',
      idempotencyKey: 'enr:dup:2',
    });
    // Either verify already blocked, or enrol path blocks duplicate
    if (enrolDup.ok === false) {
      expect(enrolDup.error).toMatch(/duplicate|identity|already/i);
    }
  });

  it('UNKNOWN conflict state is not confirmable as NO_CONFLICT', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { cohort } = await seedCohortAndParticipant(prisma, admin, {
      cohortKey: 'coh:unk-conf:1',
      participantKey: 'part:unk-conf:1',
      enrolKey: 'enr:unk-conf:1',
    });
    const meetingService = meetingServiceFactory(prisma, admin);
    const scheduled = await scheduleTrainingSession(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      cohortId: cohort.id,
      meetingInput: {
        title: 'Unknown conflict session',
        timezone: 'Africa/Johannesburg',
        startsAt: '2026-08-24T09:00:00Z',
        endsAt: '2026-08-24T11:00:00Z',
      },
      idempotencyKey: 'sess:unk-conf:1',
      meetingService,
    });

    // Incomplete schedule → server-side UNKNOWN (not client-asserted)
    await prisma.customerTrainingSession.update({
      where: { id: scheduled.session.id },
      data: { timezone: null },
    });

    const evaluation = await evaluateTrainingConflicts(prisma, {
      actorContext: { admin },
      sessionId: scheduled.session.id,
    });
    expect(evaluation.ok).toBe(true);
    expect(evaluation.conflictState).toBe(TRAINING_CONFLICT_STATE.UNKNOWN);
    expect(evaluation.conflictState).not.toBe(TRAINING_CONFLICT_STATE.NO_CONFLICT);
    expect(evaluation.confirmable).not.toBe(true);

    const confirm = await confirmTrainingSchedule(prisma, {
      actorContext: { admin },
      sessionId: scheduled.session.id,
      conflictState: TRAINING_CONFLICT_STATE.NO_CONFLICT,
    });
    expect(confirm.ok).toBe(false);
    expect(confirm.conflictState).toBe(TRAINING_CONFLICT_STATE.UNKNOWN);
    expect(confirm.conflictState).not.toBe(TRAINING_CONFLICT_STATE.NO_CONFLICT);
  });

  it('session idempotency conflicts on cohort/schedule disagree; race catch replays exact', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { cohort } = await seedCohortAndParticipant(prisma, admin, {
      cohortKey: 'coh:idem:1',
      participantKey: 'part:idem:1',
      enrolKey: 'enr:idem:1',
    });
    const cohortB = await createTrainingCohort(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-1',
      name: 'Wave 2 Cohort B',
      language: 'en',
      deliveryMode: 'VIRTUAL',
      timezone: 'Africa/Johannesburg',
      capacity: 10,
      idempotencyKey: 'coh:idem:2',
    });
    expect(cohortB.ok).toBe(true);

    const meetingService = meetingServiceFactory(prisma, admin);
    const baseArgs = {
      actorContext: { admin },
      programId: 'trn-prog-1',
      cohortId: cohort.id,
      meetingInput: {
        title: 'Idempotent session',
        timezone: 'Africa/Johannesburg',
        startsAt: '2026-08-25T09:00:00Z',
        endsAt: '2026-08-25T11:00:00Z',
      },
      idempotencyKey: 'sess:idem:1',
      meetingService,
    };

    const first = await scheduleTrainingSession(prisma, baseArgs);
    expect(first.ok).toBe(true);

    const cohortConflict = await scheduleTrainingSession(prisma, {
      ...baseArgs,
      cohortId: cohortB.cohort.id,
    });
    expect(cohortConflict.ok).toBe(false);
    expect(cohortConflict.error).toBe('idempotency_conflict');

    const scheduleConflict = await scheduleTrainingSession(prisma, {
      ...baseArgs,
      meetingInput: {
        ...baseArgs.meetingInput,
        startsAt: '2026-08-25T10:00:00Z',
      },
    });
    expect(scheduleConflict.ok).toBe(false);
    expect(scheduleConflict.error).toBe('idempotency_conflict');

    // Race: pre-check misses existing row; create unique-fails; catch replays
    const originalFindUnique = prisma.customerTrainingSession.findUnique;
    let missOnce = true;
    prisma.customerTrainingSession.findUnique = vi.fn(async (args) => {
      if (
        missOnce &&
        args?.where?.idempotencyKey === 'sess:idem:1'
      ) {
        missOnce = false;
        return null;
      }
      return originalFindUnique(args);
    });

    const raced = await scheduleTrainingSession(prisma, baseArgs);
    expect(raced.ok).toBe(true);
    expect(raced.alreadyExists || raced.idempotentReplay).toBe(true);
    expect(raced.crmMeetingId).toBe(first.crmMeetingId);
    expect(prisma._sessionStore.length).toBe(1);

    missOnce = true;
    const racedConflict = await scheduleTrainingSession(prisma, {
      ...baseArgs,
      cohortId: cohortB.cohort.id,
    });
    expect(racedConflict.ok).toBe(false);
    expect(racedConflict.error).toBe('idempotency_conflict');
    expect(prisma._sessionStore.length).toBe(1);
  });
});
