/**
 * Phase 13 Wave 1 — Activity spine + Task migrate + Follow-Up + Next-Action.
 * Activity ≠ Audit/Analytics; Task ≠ CsTask; Planned ≠ completed by due date.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CRM_ACTIVITY_TYPE,
  CRM_ACTIVITY_STATUS,
  CRM_ACTIVITY_DIRECTION,
  CRM_TASK_STATUS,
  CRM_NOTE_VISIBILITY,
  CRM_NEXT_ACTION_STATUS,
  CRM_ACTIVITY_NUMBER_RE,
  CRM_TASK_NUMBER_RE,
  allocateActivityNumber,
  createCrmActivity,
  getCrmActivity,
  listCrmActivities,
  transitionActivityStatus,
  createTask,
  completeTask,
  reopenTask,
  createFollowUp,
  completeFollowUp,
  rescheduleFollowUp,
  evaluateNextAction,
  listNoNextActionOpportunities,
  createNote,
  listNotes,
  projectNotesForViewer,
  isActivityStatusCompatible,
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
  const taskStore = overrides._taskStore || [];
  const followUpStore = overrides._followUpStore || [];
  const followUpHistoryStore = overrides._followUpHistoryStore || [];
  const noteStore = overrides._noteStore || [];
  const timelineStore = overrides._timelineStore || [];
  const opportunityStore = overrides._opportunityStore || [];
  const consentStore = overrides._consentStore || [];
  const dncStore = overrides._dncStore || [];

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
      findMany: vi.fn(async ({ where = {}, take, skip, orderBy } = {}) => {
        let rows = [...activityStore];
        if (where.type) rows = rows.filter((r) => r.type === where.type);
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.ownerAdminId) {
          rows = rows.filter((r) => r.ownerAdminId === where.ownerAdminId);
        }
        if (where.primarySubjectType) {
          rows = rows.filter((r) => r.primarySubjectType === where.primarySubjectType);
        }
        if (where.primarySubjectId) {
          rows = rows.filter((r) => r.primarySubjectId === where.primarySubjectId);
        }
        if (orderBy?.createdAt === 'desc') {
          rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        const start = typeof skip === 'number' ? skip : 0;
        const limit = typeof take === 'number' ? take : rows.length;
        return rows.slice(start, start + limit);
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
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...statusHistoryStore];
        if (where.activityId) {
          rows = rows.filter((r) => r.activityId === where.activityId);
        }
        return rows;
      }),
    },
    crmActivityRelation: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `rel-${relationStore.length + 1}`, ...data };
        relationStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...relationStore];
        if (where.activityId) rows = rows.filter((r) => r.activityId === where.activityId);
        if (where.relatedType) rows = rows.filter((r) => r.relatedType === where.relatedType);
        if (where.relatedId) rows = rows.filter((r) => r.relatedId === where.relatedId);
        return rows;
      }),
    },
    crmActivityParticipant: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `part-${participantStore.length + 1}`, ...data };
        participantStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...participantStore];
        if (where.activityId) rows = rows.filter((r) => r.activityId === where.activityId);
        return rows;
      }),
    },
    crmTask: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `task-${taskStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          completedAt: data.completedAt ?? null,
          activityId: data.activityId ?? null,
          taskNumber: data.taskNumber ?? null,
          ...data,
        };
        taskStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return taskStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findMany: vi.fn(async ({ where = {}, take, skip, orderBy } = {}) => {
        let rows = [...taskStore];
        if (where.subjectType) rows = rows.filter((r) => r.subjectType === where.subjectType);
        if (where.subjectId) rows = rows.filter((r) => r.subjectId === where.subjectId);
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.assigneeAdminId) {
          rows = rows.filter((r) => r.assigneeAdminId === where.assigneeAdminId);
        }
        if (where.activityId) rows = rows.filter((r) => r.activityId === where.activityId);
        if (orderBy?.createdAt === 'desc') {
          rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        const start = typeof skip === 'number' ? skip : 0;
        const limit = typeof take === 'number' ? take : rows.length;
        return rows.slice(start, start + limit);
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = taskStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmFollowUp: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `fu-${followUpStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          completedAt: data.completedAt ?? null,
          ...data,
        };
        followUpStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return followUpStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findMany: vi.fn(async ({ where = {}, take, skip, orderBy } = {}) => {
        let rows = [...followUpStore];
        if (where.subjectType) rows = rows.filter((r) => r.subjectType === where.subjectType);
        if (where.subjectId) rows = rows.filter((r) => r.subjectId === where.subjectId);
        if (where.status) {
          if (typeof where.status === 'object' && where.status.in) {
            rows = rows.filter((r) => where.status.in.includes(r.status));
          } else {
            rows = rows.filter((r) => r.status === where.status);
          }
        }
        if (orderBy?.dueAt === 'asc') {
          rows.sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0));
        }
        const start = typeof skip === 'number' ? skip : 0;
        const limit = typeof take === 'number' ? take : rows.length;
        return rows.slice(start, start + limit);
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = followUpStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmFollowUpHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `fuh-${followUpHistoryStore.length + 1}`, ...data };
        followUpHistoryStore.push(row);
        return row;
      }),
    },
    crmNote: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: `note-${noteStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          activityId: data.activityId ?? null,
          ...data,
        };
        noteStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {}, take, skip } = {}) => {
        let rows = [...noteStore];
        if (where.subjectType) rows = rows.filter((r) => r.subjectType === where.subjectType);
        if (where.subjectId) rows = rows.filter((r) => r.subjectId === where.subjectId);
        if (where.activityId) rows = rows.filter((r) => r.activityId === where.activityId);
        const start = typeof skip === 'number' ? skip : 0;
        const limit = typeof take === 'number' ? take : rows.length;
        return rows.slice(start, start + limit);
      }),
    },
    crmTimelineEvent: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: `tl-${timelineStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          ...data,
        };
        timelineStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...timelineStore];
        if (where.subjectType) rows = rows.filter((r) => r.subjectType === where.subjectType);
        if (where.subjectId) rows = rows.filter((r) => r.subjectId === where.subjectId);
        return rows;
      }),
    },
    crmOpportunity: {
      findMany: vi.fn(async ({ where = {}, take } = {}) => {
        let rows = [...opportunityStore];
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.mergedIntoOpportunityId === null) {
          rows = rows.filter((r) => !r.mergedIntoOpportunityId);
        }
        const limit = typeof take === 'number' ? take : rows.length;
        return rows.slice(0, limit);
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return opportunityStore.find((r) => r.id === where.id) || null;
        return null;
      }),
    },
    crmConsentRecord: {
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
      statusHistoryStore,
      relationStore,
      participantStore,
      taskStore,
      followUpStore,
      followUpHistoryStore,
      noteStore,
      timelineStore,
      opportunityStore,
      consentStore,
      dncStore,
    },
  };

  return prisma;
}

describe('CRM Activity Wave 1 — catalogue compatibility', () => {
  it('exposes canonical types, statuses, directions', () => {
    expect(CRM_ACTIVITY_TYPE.TASK).toBe('TASK');
    expect(CRM_ACTIVITY_TYPE.FOLLOW_UP).toBe('FOLLOW_UP');
    expect(CRM_ACTIVITY_STATUS.PLANNED).toBe('PLANNED');
    expect(CRM_ACTIVITY_STATUS.COMPLETED).toBe('COMPLETED');
    expect(CRM_ACTIVITY_STATUS.BLOCKED_BY_CONSENT).toBe('BLOCKED_BY_CONSENT');
    expect(CRM_ACTIVITY_DIRECTION.OUTBOUND).toBe('OUTBOUND');
    expect(CRM_ACTIVITY_DIRECTION.INTERNAL).toBe('INTERNAL');
  });

  it('rejects incompatible type↔status pairs fail-closed', () => {
    expect(
      isActivityStatusCompatible(CRM_ACTIVITY_TYPE.TASK, CRM_ACTIVITY_STATUS.BLOCKED_BY_CONSENT)
    ).toBe(false);
    expect(
      isActivityStatusCompatible(CRM_ACTIVITY_TYPE.FOLLOW_UP, CRM_ACTIVITY_STATUS.IN_PROGRESS)
    ).toBe(false);
    expect(
      isActivityStatusCompatible(CRM_ACTIVITY_TYPE.TASK, CRM_ACTIVITY_STATUS.OPEN)
    ).toBe(true);
    expect(
      isActivityStatusCompatible(
        CRM_ACTIVITY_TYPE.FOLLOW_UP,
        CRM_ACTIVITY_STATUS.BLOCKED_BY_CONSENT
      )
    ).toBe(true);
  });
});

describe('CRM Activity Wave 1 — numbering', () => {
  it('allocates unique immutable ACT-YYYY-###### numbers', async () => {
    const prisma = makePrisma();
    const a = await allocateActivityNumber(prisma, {
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    const b = await allocateActivityNumber(prisma, {
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.number).toMatch(CRM_ACTIVITY_NUMBER_RE);
    expect(b.number).toMatch(CRM_ACTIVITY_NUMBER_RE);
    expect(a.number).not.toBe(b.number);
    expect(a.number).toBe('ACT-2026-000001');
    expect(b.number).toBe('ACT-2026-000002');
  });
});

describe('CRM Activity Wave 1 — create / status / list', () => {
  it('creates activity with number, relation, and fail-closed status transition', async () => {
    const prisma = makePrisma();
    const admin = makeAdmin('a1', { viewLeads: true, editLeads: true });
    const created = await createCrmActivity(prisma, {
      admin,
      type: CRM_ACTIVITY_TYPE.TASK,
      status: CRM_ACTIVITY_STATUS.OPEN,
      direction: CRM_ACTIVITY_DIRECTION.INTERNAL,
      title: 'Call prospect',
      primarySubjectType: 'LEAD',
      primarySubjectId: 'lead-1',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(created.ok).toBe(true);
    expect(created.activity.activityNumber).toMatch(CRM_ACTIVITY_NUMBER_RE);
    expect(created.activity.type).toBe('TASK');
    expect(created.activity.status).toBe('OPEN');

    const got = await getCrmActivity(prisma, {
      admin,
      activityId: created.activity.id,
    });
    expect(got.ok).toBe(true);
    expect(got.activity.id).toBe(created.activity.id);

    const bad = await transitionActivityStatus(prisma, {
      admin,
      activityId: created.activity.id,
      toStatus: CRM_ACTIVITY_STATUS.BLOCKED_BY_CONSENT,
    });
    expect(bad.ok).toBe(false);
    expect(bad.error).toMatch(/incompatible|invalid/i);

    const done = await transitionActivityStatus(prisma, {
      admin,
      activityId: created.activity.id,
      toStatus: CRM_ACTIVITY_STATUS.COMPLETED,
    });
    expect(done.ok).toBe(true);
    expect(done.activity.status).toBe('COMPLETED');

    // Due date alone never marks complete
    const planned = await createCrmActivity(prisma, {
      admin,
      type: CRM_ACTIVITY_TYPE.TASK,
      status: CRM_ACTIVITY_STATUS.PLANNED,
      title: 'Past due still planned',
      primarySubjectType: 'LEAD',
      primarySubjectId: 'lead-1',
      dueAt: new Date('2020-01-01T00:00:00.000Z'),
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(planned.ok).toBe(true);
    expect(planned.activity.status).toBe('PLANNED');

    const listed = await listCrmActivities(prisma, {
      admin,
      primarySubjectType: 'LEAD',
      primarySubjectId: 'lead-1',
    });
    expect(listed.ok).toBe(true);
    expect(listed.items.length).toBeGreaterThanOrEqual(2);
  });
});

describe('CRM Activity Wave 1 — Task migrate under Activity', () => {
  it('links Lead/Opportunity tasks under a single Activity domain', async () => {
    const prisma = makePrisma();
    const admin = makeAdmin('ed-1', {
      viewLeads: true,
      editLeads: true,
      opportunitiesView: true,
      opportunitiesEdit: true,
    });

    const leadTask = await createTask(prisma, {
      admin,
      subjectType: 'LEAD',
      subjectId: 'lead-1',
      title: 'First contact',
      allocateTaskNumber: true,
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(leadTask.ok).toBe(true);
    expect(leadTask.task.activityId).toBeTruthy();
    expect(leadTask.task.taskNumber).toMatch(CRM_TASK_NUMBER_RE);
    expect(leadTask.activity?.type).toBe(CRM_ACTIVITY_TYPE.TASK);

    const oppTask = await createTask(prisma, {
      admin,
      subjectType: 'OPPORTUNITY',
      subjectId: 'opp-1',
      title: 'Send proposal pack',
      now: new Date('2026-07-30T13:00:00.000Z'),
    });
    expect(oppTask.ok).toBe(true);
    expect(oppTask.task.activityId).toBeTruthy();
    expect(oppTask.task.activityId).not.toBe(leadTask.task.activityId);

    const done = await completeTask(prisma, { admin, taskId: leadTask.task.id });
    expect(done.ok).toBe(true);
    expect(done.task.status).toBe(CRM_TASK_STATUS.COMPLETED);

    const again = await completeTask(prisma, { admin, taskId: leadTask.task.id });
    expect(again.ok).toBe(true);
    expect(again.alreadyCompleted).toBe(true);

    const reopened = await reopenTask(prisma, { admin, taskId: leadTask.task.id });
    expect(reopened.ok).toBe(true);
    expect(reopened.task.status).toBe(CRM_TASK_STATUS.TODO);

    const act = await getCrmActivity(prisma, {
      admin,
      activityId: leadTask.task.activityId,
    });
    expect(act.ok).toBe(true);
    expect(act.activity.status).toBe(CRM_ACTIVITY_STATUS.OPEN);
  });

  it('fail-closes Task create when Activity create fails (no orphan Task)', async () => {
    const prisma = makePrisma();
    // Activity model remains present; numbering failure makes createCrmActivity return !ok
    delete prisma.crmNumberSeq;

    const admin = makeAdmin('ed-fail', {
      viewLeads: true,
      editLeads: true,
    });

    const result = await createTask(prisma, {
      admin,
      subjectType: 'LEAD',
      subjectId: 'lead-orphan',
      title: 'Must not orphan',
      now: new Date('2026-07-30T14:00:00.000Z'),
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(prisma.crmTask.create).not.toHaveBeenCalled();
  });
});

describe('CRM Activity Wave 1 — Follow-Up + Next-Action', () => {
  it('blocks consent Follow-Ups without auto-execute and evaluates next-action honestly', async () => {
    const prisma = makePrisma({
      _consentStore: [
        {
          contactId: 'con-1',
          purpose: 'SALES_CONTACT',
          status: 'DENIED',
          createdAt: new Date('2026-01-01'),
        },
      ],
      _opportunityStore: [
        {
          id: 'opp-open-1',
          opportunityNumber: 'OPP-2026-000001',
          status: 'OPEN',
          stageCode: 'QUALIFICATION',
          mergedIntoOpportunityId: null,
        },
        {
          id: 'opp-with-task',
          opportunityNumber: 'OPP-2026-000002',
          status: 'OPEN',
          stageCode: 'PROPOSAL',
          mergedIntoOpportunityId: null,
        },
      ],
    });
    const admin = superAdmin();

    const blocked = await createFollowUp(prisma, {
      admin,
      subjectType: 'LEAD',
      subjectId: 'lead-1',
      contactId: 'con-1',
      channel: 'EMAIL',
      purpose: 'SALES_CONTACT',
      title: 'Email follow-up',
      dueAt: new Date('2026-08-01T10:00:00.000Z'),
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(blocked.ok).toBe(true);
    expect(blocked.followUp.status).toBe('BLOCKED_BY_CONSENT');
    expect(blocked.followUp.autoExecuted).toBe(false);
    expect(blocked.activity.status).toBe(CRM_ACTIVITY_STATUS.BLOCKED_BY_CONSENT);

    const missing = await evaluateNextAction(prisma, {
      admin,
      subjectType: 'OPPORTUNITY',
      subjectId: 'opp-open-1',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(missing.ok).toBe(true);
    expect(missing.status).toBe(CRM_NEXT_ACTION_STATUS.MISSING);
    expect(missing.fabricated).toBe(false);
    expect(missing.nextAction).toBeNull();

    await createTask(prisma, {
      admin,
      subjectType: 'OPPORTUNITY',
      subjectId: 'opp-with-task',
      title: 'Next step',
      dueAt: new Date('2026-08-05T12:00:00.000Z'),
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    const valid = await evaluateNextAction(prisma, {
      admin,
      subjectType: 'OPPORTUNITY',
      subjectId: 'opp-with-task',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(valid.status).toBe(CRM_NEXT_ACTION_STATUS.VALID);
    expect(valid.nextAction?.kind).toBe('TASK');

    const overdueFu = await createFollowUp(prisma, {
      admin,
      subjectType: 'LEAD',
      subjectId: 'lead-2',
      title: 'Call back',
      channel: 'CALL',
      dueAt: new Date('2026-07-01T10:00:00.000Z'),
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(overdueFu.ok).toBe(true);
    expect(overdueFu.followUp.status).toBe('OPEN');

    const overdue = await evaluateNextAction(prisma, {
      admin,
      subjectType: 'LEAD',
      subjectId: 'lead-2',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(overdue.status).toBe(CRM_NEXT_ACTION_STATUS.OVERDUE);

    const completed = await completeFollowUp(prisma, {
      admin,
      followUpId: overdueFu.followUp.id,
      now: new Date('2026-07-30T13:00:00.000Z'),
    });
    expect(completed.ok).toBe(true);
    expect(completed.followUp.status).toBe('COMPLETED');

    const openFu = await createFollowUp(prisma, {
      admin,
      subjectType: 'LEAD',
      subjectId: 'lead-3',
      title: 'Reschedule me',
      dueAt: new Date('2026-08-01T10:00:00.000Z'),
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    const rescheduled = await rescheduleFollowUp(prisma, {
      admin,
      followUpId: openFu.followUp.id,
      dueAt: new Date('2026-08-10T10:00:00.000Z'),
      now: new Date('2026-07-30T14:00:00.000Z'),
    });
    expect(rescheduled.ok).toBe(true);
    expect(new Date(rescheduled.followUp.dueAt).toISOString()).toBe(
      '2026-08-10T10:00:00.000Z'
    );

    const noNext = await listNoNextActionOpportunities(prisma, {
      admin,
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(noNext.ok).toBe(true);
    expect(noNext.items.some((o) => o.id === 'opp-open-1')).toBe(true);
    expect(noNext.items.some((o) => o.id === 'opp-with-task')).toBe(false);
  });
});

describe('CRM Activity Wave 1 — restricted notes remain protected', () => {
  it('omits RESTRICTED bodies for unprivileged viewers (Activity subject ok)', async () => {
    const prisma = makePrisma();
    const author = makeAdmin('auth-1', {
      viewLeads: true,
      editLeads: true,
      mergeLeads: true,
      manageConsent: true,
    });
    const viewer = makeAdmin('view-1', { viewLeads: true });

    const act = await createCrmActivity(prisma, {
      admin: author,
      type: CRM_ACTIVITY_TYPE.NOTE,
      status: CRM_ACTIVITY_STATUS.OPEN,
      title: 'Note activity',
      primarySubjectType: 'LEAD',
      primarySubjectId: 'lead-1',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });

    await createNote(prisma, {
      admin: author,
      subjectType: 'LEAD',
      subjectId: 'lead-1',
      body: 'secret',
      visibility: CRM_NOTE_VISIBILITY.RESTRICTED,
      activityId: act.activity.id,
    });
    await createNote(prisma, {
      admin: author,
      subjectType: 'ACTIVITY',
      subjectId: act.activity.id,
      body: 'internal on activity',
      visibility: CRM_NOTE_VISIBILITY.INTERNAL,
      activityId: act.activity.id,
    });

    const listed = await listNotes(prisma, {
      admin: viewer,
      subjectType: 'LEAD',
      subjectId: 'lead-1',
    });
    expect(listed.ok).toBe(true);
    expect(listed.items.every((n) => n.visibility !== CRM_NOTE_VISIBILITY.RESTRICTED)).toBe(
      true
    );

    const projected = projectNotesForViewer(
      [
        { visibility: 'INTERNAL', body: 'a', activityId: act.activity.id },
        { visibility: 'RESTRICTED', body: 'b', activityId: act.activity.id },
      ],
      { canViewRestricted: false, mode: 'omit' }
    );
    expect(projected).toHaveLength(1);
  });
});
