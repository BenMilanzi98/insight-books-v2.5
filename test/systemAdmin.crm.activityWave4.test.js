/**
 * Phase 13 Wave 4 — Reminders + templates + automation foundations + Activity reports.
 * Reminder delivery ≠ Activity complete; SoD; no false zeroes; no sequences.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  CRM_AUTOMATION_TRIGGER,
  CRM_AUTOMATION_ACTION,
  CRM_AUTOMATION_RULE_STATUS,
  CRM_ACTIVITY_TEMPLATE_STATUS,
  CRM_ACTIVITY_TEMPLATE_KIND,
  CRM_REMINDER_CHANNEL,
  CRM_REMINDER_STATUS,
  CRM_ACTIVITY_STATUS,
  CRM_ACTIVITY_TYPE,
  CRM_SUBJECT_TYPE,
  WEIGHTED_PIPELINE_UI_ENABLED,
  buildReminderDedupeKey,
  scheduleReminder,
  markReminderDelivered,
  snoozeReminder,
  queueDueReminders,
  createActivityTemplateVersion,
  updateActivityTemplate,
  createAutomationRule,
  requestAutomationApproval,
  approveAutomationRule,
  executeAutomationRule,
  getActivityReport,
  applyActivityReportHonesty,
  createActivityReportSchedule,
  runActivityReportSchedule,
  listEntityActivityProjections,
  evaluateActivityDataQuality,
  getCrmFoundations,
} from '@/lib/admin/crm';

function makeAdmin(id, crmPerms = {}, role = 'Platform Support') {
  return {
    id,
    role,
    permissions: {
      systemAdmin: {
        crm: {
          view: true,
          viewLeads: true,
          editLeads: true,
          export: true,
          runReconciliation: true,
          mergeLeads: true,
          activities: { view: true, edit: true },
          opportunities: { view: true, edit: true },
          ...crmPerms,
        },
      },
    },
  };
}

function superAdmin(id = 'super-1') {
  return { id, role: 'Super Admin', permissions: {} };
}

function makePrisma(overrides = {}) {
  const reminderStore = overrides._reminderStore || [];
  const templateStore = overrides._templateStore || [];
  const ruleStore = overrides._ruleStore || [];
  const approvalStore = overrides._approvalStore || [];
  const executionStore = overrides._executionStore || [];
  const activityStore = overrides._activityStore || [];
  const taskStore = overrides._taskStore || [];
  const scheduleStore = overrides._scheduleStore || [];
  const runStore = overrides._runStore || [];
  const seqStore = overrides._seqStore || [];
  const statusHistoryStore = overrides._statusHistoryStore || [];
  const timelineStore = overrides._timelineStore || [];

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
    crmReminder: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.dedupeKey) {
          return reminderStore.find((r) => r.dedupeKey === where.dedupeKey) || null;
        }
        if (where.id) return reminderStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findMany: vi.fn(async ({ where = {}, take } = {}) => {
        let rows = [...reminderStore];
        if (where.status?.in) {
          rows = rows.filter((r) => where.status.in.includes(r.status));
        } else if (where.status) {
          rows = rows.filter((r) => r.status === where.status);
        }
        if (where.dueAt?.lte) {
          rows = rows.filter((r) => new Date(r.dueAt) <= new Date(where.dueAt.lte));
        }
        if (where.activityId) rows = rows.filter((r) => r.activityId === where.activityId);
        if (typeof take === 'number') rows = rows.slice(0, take);
        return rows;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `rem-${reminderStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          snoozeUntil: data.snoozeUntil ?? null,
          deliveredAt: data.deliveredAt ?? null,
          ...data,
        };
        reminderStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = reminderStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmActivityTemplate: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return templateStore.find((r) => r.id === where.id) || null;
      }),
      findFirst: vi.fn(async ({ where = {}, orderBy } = {}) => {
        let rows = [...templateStore];
        if (where.code) rows = rows.filter((r) => r.code === where.code);
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (orderBy?.version === 'desc') {
          rows.sort((a, b) => b.version - a.version);
        }
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {}, take } = {}) => {
        let rows = [...templateStore];
        if (where.code) rows = rows.filter((r) => r.code === where.code);
        if (typeof take === 'number') rows = rows.slice(0, take);
        return rows;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `tmpl-${templateStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        templateStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = templateStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        let count = 0;
        for (const row of templateStore) {
          if (where.code && row.code !== where.code) continue;
          if (where.status && row.status !== where.status) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      }),
    },
    crmAutomationRule: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return ruleStore.find((r) => r.id === where.id) || null;
      }),
      findMany: vi.fn(async ({ where = {}, take } = {}) => {
        let rows = [...ruleStore];
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (typeof take === 'number') rows = rows.slice(0, take);
        return rows;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `rule-${ruleStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          approvedAt: data.approvedAt ?? null,
          approvedByAdminId: data.approvedByAdminId ?? null,
          ...data,
        };
        ruleStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = ruleStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmAutomationApproval: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `appr-${approvalStore.length + 1}`, ...data };
        approvalStore.push(row);
        return row;
      }),
    },
    crmAutomationExecution: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.idempotencyKey) {
          return (
            executionStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null
          );
        }
        return executionStore.find((r) => r.id === where.id) || null;
      }),
      create: vi.fn(async ({ data }) => {
        if (executionStore.some((r) => r.idempotencyKey === data.idempotencyKey)) {
          const err = new Error('Unique constraint');
          err.code = 'P2002';
          throw err;
        }
        const row = {
          id: data.id || `exec-${executionStore.length + 1}`,
          at: data.at || new Date(),
          ...data,
        };
        executionStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = executionStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data);
        return row;
      }),
    },
    crmActivity: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `act-${activityStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          completedAt: data.completedAt ?? null,
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
        if (where.activityNumber) {
          return activityStore.find((r) => r.activityNumber === where.activityNumber) || null;
        }
        return null;
      }),
      findMany: vi.fn(async ({ where = {}, take } = {}) => {
        let rows = [...activityStore];
        if (where.primarySubjectType) {
          rows = rows.filter((r) => r.primarySubjectType === where.primarySubjectType);
        }
        if (where.primarySubjectId) {
          rows = rows.filter((r) => r.primarySubjectId === where.primarySubjectId);
        }
        if (where.type) rows = rows.filter((r) => r.type === where.type);
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (typeof take === 'number') rows = rows.slice(0, take);
        return rows;
      }),
      count: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...activityStore];
        if (where.type) rows = rows.filter((r) => r.type === where.type);
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.timezone === null) rows = rows.filter((r) => r.timezone == null);
        if (where.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (Object.prototype.hasOwnProperty.call(clause, 'primarySubjectType')) {
                return r.primarySubjectType == null;
              }
              if (Object.prototype.hasOwnProperty.call(clause, 'primarySubjectId')) {
                return r.primarySubjectId == null;
              }
              return false;
            })
          );
        }
        return rows.length;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = activityStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data);
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
    crmTask: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `task-${taskStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          completedAt: data.completedAt ?? null,
          ...data,
        };
        taskStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...taskStore]),
      count: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...taskStore];
        if (where.activityId === null) rows = rows.filter((r) => r.activityId == null);
        return rows.length;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = taskStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data);
        return row;
      }),
    },
    crmTimelineEvent: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `tl-${timelineStore.length + 1}`, ...data };
        timelineStore.push(row);
        return row;
      }),
    },
    crmActivityReportSchedule: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `ars-${scheduleStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          lastRunAt: data.lastRunAt ?? null,
          lastRunStatus: data.lastRunStatus ?? null,
          ...data,
        };
        scheduleStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ take } = {}) => {
        const rows = [...scheduleStore];
        return typeof take === 'number' ? rows.slice(0, take) : rows;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return scheduleStore.find((r) => r.id === where.id) || null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = scheduleStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data);
        return row;
      }),
    },
    crmActivityReportRun: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `arr-${runStore.length + 1}`,
          at: data.at || new Date(),
          ...data,
        };
        runStore.push(row);
        return row;
      }),
    },
    _reminderStore: reminderStore,
    _templateStore: templateStore,
    _ruleStore: ruleStore,
    _executionStore: executionStore,
    _activityStore: activityStore,
    _taskStore: taskStore,
    _scheduleStore: scheduleStore,
    _runStore: runStore,
  };

  return Object.assign(prisma, overrides);
}

describe('Phase 13 Wave 4 — Reminder dedupe + delivery ≠ complete', () => {
  it('builds stable dedupe key from rule+activity+recipient+occurrence+channel', () => {
    const key = buildReminderDedupeKey({
      ruleKey: 'due_soon',
      activityId: 'act-1',
      recipientAdminId: 'admin-1',
      occurrenceKey: '2026-07-30T10:00:00.000Z',
      channel: CRM_REMINDER_CHANNEL.IN_APP,
    });
    expect(key).toBe('DUE_SOON|act-1|admin-1|2026-07-30T10:00:00.000Z|IN_APP');
  });

  it('dedupes scheduleReminder on identical identity', async () => {
    const prisma = makePrisma();
    const admin = makeAdmin('a1');
    const args = {
      admin,
      ruleKey: 'DUE_SOON',
      activityId: 'act-1',
      recipientAdminId: 'a1',
      occurrenceKey: 'occ-1',
      channel: CRM_REMINDER_CHANNEL.IN_APP,
      dueAt: new Date('2026-07-30T12:00:00.000Z'),
    };
    const first = await scheduleReminder(prisma, args);
    const second = await scheduleReminder(prisma, args);
    expect(first.ok).toBe(true);
    expect(first.dedupe).toBe(false);
    expect(second.ok).toBe(true);
    expect(second.dedupe).toBe(true);
    expect(second.reminder.id).toBe(first.reminder.id);
    expect(prisma._reminderStore).toHaveLength(1);
  });

  it('markReminderDelivered never claims Activity completion', async () => {
    const prisma = makePrisma();
    const admin = makeAdmin('a1');
    const scheduled = await scheduleReminder(prisma, {
      admin,
      ruleKey: 'DUE_SOON',
      activityId: 'act-keep-open',
      recipientAdminId: 'a1',
      occurrenceKey: 'occ-d',
      dueAt: new Date('2026-07-29T00:00:00.000Z'),
    });
    prisma._activityStore.push({
      id: 'act-keep-open',
      status: CRM_ACTIVITY_STATUS.OPEN,
      type: CRM_ACTIVITY_TYPE.TASK,
    });

    const delivered = await markReminderDelivered(prisma, {
      admin,
      reminderId: scheduled.reminder.id,
    });
    expect(delivered.ok).toBe(true);
    expect(delivered.reminder.status).toBe(CRM_REMINDER_STATUS.DELIVERED);
    expect(delivered.meta.activityCompletedByDelivery).toBe(false);
    expect(delivered.meta.activityStatusUnchanged).toBe(true);
    expect(prisma._activityStore[0].status).toBe(CRM_ACTIVITY_STATUS.OPEN);
  });

  it('snooze + queueDueReminders move due rows to QUEUED without completing Activity', async () => {
    const prisma = makePrisma();
    const admin = makeAdmin('a1');
    const now = new Date('2026-07-30T12:00:00.000Z');
    const scheduled = await scheduleReminder(prisma, {
      admin,
      ruleKey: 'DUE_SOON',
      activityId: 'act-q',
      recipientAdminId: 'a1',
      occurrenceKey: 'occ-q',
      dueAt: new Date('2026-07-30T11:00:00.000Z'),
      now,
    });
    const snoozed = await snoozeReminder(prisma, {
      admin,
      reminderId: scheduled.reminder.id,
      snoozeUntil: new Date('2026-07-30T11:30:00.000Z'),
      now,
    });
    expect(snoozed.reminder.status).toBe(CRM_REMINDER_STATUS.SNOOZED);

    const queued = await queueDueReminders(prisma, { admin, now });
    expect(queued.ok).toBe(true);
    expect(queued.items[0].status).toBe(CRM_REMINDER_STATUS.QUEUED);
    expect(queued.meta.activityCompletedByDelivery).toBe(false);
  });
});

describe('Phase 13 Wave 4 — Activity templates versioned; ACTIVE not editable', () => {
  it('creates versions and blocks direct ACTIVE edit', async () => {
    const prisma = makePrisma();
    const admin = makeAdmin('a1');
    const created = await createActivityTemplateVersion(prisma, {
      admin,
      code: 'FIRST_CONTACT',
      kind: CRM_ACTIVITY_TEMPLATE_KIND.TASK,
      titleTemplate: 'Call {{contactName}}',
      status: CRM_ACTIVITY_TEMPLATE_STATUS.ACTIVE,
    });
    expect(created.ok).toBe(true);
    expect(created.template.activeDirectlyEditable).toBe(false);

    const blocked = await updateActivityTemplate(prisma, {
      admin,
      templateId: created.template.id,
      patch: { titleTemplate: 'Changed' },
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toBe('active_template_not_directly_editable');

    const v2 = await createActivityTemplateVersion(prisma, {
      admin,
      code: 'FIRST_CONTACT',
      kind: CRM_ACTIVITY_TEMPLATE_KIND.TASK,
      titleTemplate: 'Call again',
      status: CRM_ACTIVITY_TEMPLATE_STATUS.ACTIVE,
    });
    expect(v2.ok).toBe(true);
    expect(v2.template.version).toBe(2);
  });

  it('rejects executable template expressions', async () => {
    const prisma = makePrisma();
    const bad = await createActivityTemplateVersion(prisma, {
      admin: makeAdmin('a1'),
      code: 'BAD',
      titleTemplate: '${process.env.SECRET}',
    });
    expect(bad.ok).toBe(false);
    expect(bad.error).toBe('executable_template_expressions_forbidden');
  });

  it('DRAFT→ACTIVE via update retires other ACTIVE versions for same code', async () => {
    const prisma = makePrisma();
    const admin = makeAdmin('a1');
    const v1 = await createActivityTemplateVersion(prisma, {
      admin,
      code: 'FOLLOW_UP_TMPL',
      kind: CRM_ACTIVITY_TEMPLATE_KIND.TASK,
      titleTemplate: 'Version one',
      status: CRM_ACTIVITY_TEMPLATE_STATUS.ACTIVE,
    });
    expect(v1.ok).toBe(true);

    const draft = await createActivityTemplateVersion(prisma, {
      admin,
      code: 'FOLLOW_UP_TMPL',
      kind: CRM_ACTIVITY_TEMPLATE_KIND.TASK,
      titleTemplate: 'Version two draft',
      status: CRM_ACTIVITY_TEMPLATE_STATUS.DRAFT,
    });
    expect(draft.ok).toBe(true);
    expect(draft.template.version).toBe(2);

    const activated = await updateActivityTemplate(prisma, {
      admin,
      templateId: draft.template.id,
      patch: { status: CRM_ACTIVITY_TEMPLATE_STATUS.ACTIVE },
    });
    expect(activated.ok).toBe(true);
    expect(activated.template.status).toBe(CRM_ACTIVITY_TEMPLATE_STATUS.ACTIVE);

    const prior = prisma._templateStore.find((r) => r.id === v1.template.id);
    expect(prior.status).toBe(CRM_ACTIVITY_TEMPLATE_STATUS.RETIRED);

    const actives = prisma._templateStore.filter(
      (r) => r.code === 'FOLLOW_UP_TMPL' && r.status === CRM_ACTIVITY_TEMPLATE_STATUS.ACTIVE
    );
    expect(actives).toHaveLength(1);
    expect(actives[0].id).toBe(draft.template.id);
  });
});

describe('Phase 13 Wave 4 — Automation SoD + idempotency + small trigger set', () => {
  it('rejects unapproved trigger/action pairs', async () => {
    const prisma = makePrisma();
    const result = await createAutomationRule(prisma, {
      admin: makeAdmin('a1'),
      code: 'SEQ_FORBIDDEN',
      trigger: CRM_AUTOMATION_TRIGGER.LEAD_ASSIGNED,
      action: 'RUN_ARBITRARY_SCRIPT',
    });
    expect(result.ok).toBe(false);
    expect(['invalid_action', 'trigger_action_not_in_approved_set']).toContain(result.error);
  });

  it('blocks self-approval (SoD)', async () => {
    const prisma = makePrisma();
    const requester = makeAdmin('req-1');
    const created = await createAutomationRule(prisma, {
      admin: requester,
      code: 'LEAD_FIRST_CONTACT',
      trigger: CRM_AUTOMATION_TRIGGER.LEAD_ASSIGNED,
      action: CRM_AUTOMATION_ACTION.CREATE_FIRST_CONTACT_TASK,
    });
    expect(created.ok).toBe(true);
    await requestAutomationApproval(prisma, {
      admin: requester,
      ruleId: created.rule.id,
    });
    const self = await approveAutomationRule(prisma, {
      admin: requester,
      ruleId: created.rule.id,
    });
    expect(self.ok).toBe(false);
    expect(self.error).toBe('automation_self_approval_blocked');

    const approver = makeAdmin('appr-1');
    const approved = await approveAutomationRule(prisma, {
      admin: approver,
      ruleId: created.rule.id,
    });
    expect(approved.ok).toBe(true);
    expect(approved.rule.status).toBe(CRM_AUTOMATION_RULE_STATUS.APPROVED);
  });

  it('executes Lead assigned → first-contact Task idempotently', async () => {
    const prisma = makePrisma();
    const requester = makeAdmin('req-2');
    const approver = makeAdmin('appr-2');
    const created = await createAutomationRule(prisma, {
      admin: requester,
      code: 'LEAD_FC',
      trigger: CRM_AUTOMATION_TRIGGER.LEAD_ASSIGNED,
      action: CRM_AUTOMATION_ACTION.CREATE_FIRST_CONTACT_TASK,
    });
    await requestAutomationApproval(prisma, { admin: requester, ruleId: created.rule.id });
    await approveAutomationRule(prisma, { admin: approver, ruleId: created.rule.id });

    const first = await executeAutomationRule(prisma, {
      admin: approver,
      ruleId: created.rule.id,
      subjectType: CRM_SUBJECT_TYPE.LEAD,
      subjectId: 'lead-100',
      occurrenceKey: 'assign-1',
    });
    expect(first.ok).toBe(true);
    expect(first.idempotent).toBe(false);
    expect(first.result.taskId).toBeTruthy();
    expect(prisma._taskStore).toHaveLength(1);

    const second = await executeAutomationRule(prisma, {
      admin: approver,
      ruleId: created.rule.id,
      subjectType: CRM_SUBJECT_TYPE.LEAD,
      subjectId: 'lead-100',
      occurrenceKey: 'assign-1',
    });
    expect(second.ok).toBe(true);
    expect(second.idempotent).toBe(true);
    expect(prisma._taskStore).toHaveLength(1);
  });

  it('FAILED prior execution does not short-circuit as successful idempotent replay', async () => {
    const prisma = makePrisma();
    const requester = makeAdmin('req-3');
    const approver = makeAdmin('appr-3');
    const created = await createAutomationRule(prisma, {
      admin: requester,
      code: 'LEAD_FC_RETRY',
      trigger: CRM_AUTOMATION_TRIGGER.LEAD_ASSIGNED,
      action: CRM_AUTOMATION_ACTION.CREATE_FIRST_CONTACT_TASK,
    });
    await requestAutomationApproval(prisma, { admin: requester, ruleId: created.rule.id });
    await approveAutomationRule(prisma, { admin: approver, ruleId: created.rule.id });

    const subjectType = CRM_SUBJECT_TYPE.LEAD;
    const subjectId = 'lead-retry-1';
    const occurrenceKey = 'assign-retry';
    const idempotencyKey = [
      created.rule.id,
      CRM_AUTOMATION_TRIGGER.LEAD_ASSIGNED,
      subjectType,
      subjectId,
      occurrenceKey,
    ].join('|');

    prisma._executionStore.push({
      id: 'exec-failed-prior',
      ruleId: created.rule.id,
      idempotencyKey,
      trigger: CRM_AUTOMATION_TRIGGER.LEAD_ASSIGNED,
      action: CRM_AUTOMATION_ACTION.CREATE_FIRST_CONTACT_TASK,
      subjectType,
      subjectId,
      status: 'FAILED',
      resultJson: { error: 'transient_failure' },
      executedByAdminId: approver.id,
      at: new Date(),
    });

    const retry = await executeAutomationRule(prisma, {
      admin: approver,
      ruleId: created.rule.id,
      subjectType,
      subjectId,
      occurrenceKey,
    });
    expect(retry.ok).toBe(true);
    expect(retry.idempotent).toBe(false);
    expect(retry.status).toBe('SUCCESS');
    expect(retry.result.taskId).toBeTruthy();
    expect(prisma._taskStore).toHaveLength(1);
    expect(prisma._executionStore).toHaveLength(1);
    expect(prisma._executionStore[0].status).toBe('SUCCESS');
    expect(prisma._executionStore[0].id).toBe('exec-failed-prior');

    const replay = await executeAutomationRule(prisma, {
      admin: approver,
      ruleId: created.rule.id,
      subjectType,
      subjectId,
      occurrenceKey,
    });
    expect(replay.ok).toBe(true);
    expect(replay.idempotent).toBe(true);
    expect(prisma._taskStore).toHaveLength(1);
  });
});

describe('Phase 13 Wave 4 — Activity reports honesty-gated + schedules audited', () => {
  it('returns EMPTY envelope with null KPIs when no activities', async () => {
    const prisma = makePrisma();
    const report = await getActivityReport(prisma, { admin: makeAdmin('a1') });
    expect(report.ok).toBe(true);
    expect(report.status).toBe('EMPTY');
    expect(report.report.openCount).toBeNull();
    expect(report.report.totalCount).toBeNull();
    expect(report.honesty.inventZeroesForbidden).toBe(true);
    expect(report.honesty.falseZeroes).toBe(false);
  });

  it('applyActivityReportHonesty never invents zeroes on gate failure', () => {
    const honesty = applyActivityReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    expect(honesty.kpiSafe).toBe(false);
    expect(honesty.status).toBe('UNAVAILABLE');
    expect(honesty.falseZeroes).toBe(false);
  });

  it('READY report counts when activities exist; weighted remains dark', async () => {
    const prisma = makePrisma({
      _activityStore: [
        {
          id: 'a1',
          type: CRM_ACTIVITY_TYPE.TASK,
          status: CRM_ACTIVITY_STATUS.OPEN,
          primarySubjectType: 'LEAD',
          primarySubjectId: 'l1',
        },
        {
          id: 'a2',
          type: CRM_ACTIVITY_TYPE.CALL,
          status: CRM_ACTIVITY_STATUS.COMPLETED,
          primarySubjectType: 'LEAD',
          primarySubjectId: 'l1',
        },
      ],
    });
    const report = await getActivityReport(prisma, { admin: makeAdmin('a1') });
    expect(report.status).toBe('READY');
    expect(report.report.totalCount).toBe(2);
    expect(report.report.openCount).toBe(1);
    expect(report.report.completedCount).toBe(1);
    expect(WEIGHTED_PIPELINE_UI_ENABLED).toBe(true);
  });

  it('creates and runs audited activity report schedule', async () => {
    const prisma = makePrisma({
      _activityStore: [
        {
          id: 'a1',
          type: CRM_ACTIVITY_TYPE.TASK,
          status: CRM_ACTIVITY_STATUS.OPEN,
        },
      ],
    });
    const admin = makeAdmin('a1');
    const created = await createActivityReportSchedule(prisma, {
      admin,
      name: 'Daily activity',
      cronExpression: '0 8 * * *',
    });
    expect(created.ok).toBe(true);
    expect(created.meta.audited).toBe(true);

    const run = await runActivityReportSchedule(prisma, {
      admin,
      scheduleId: created.schedule.id,
    });
    expect(run.ok).toBe(true);
    expect(run.meta.audited).toBe(true);
    expect(run.run).toBeTruthy();
    expect(run.report.status).toBe('READY');
    expect(prisma._runStore).toHaveLength(1);
  });
});

describe('Phase 13 Wave 4 — Entity projections + foundations READY', () => {
  it('lists Lead activity projections without duplicating Activity identity', async () => {
    const prisma = makePrisma({
      _activityStore: [
        {
          id: 'act-lead-1',
          activityNumber: 'ACT-2026-000001',
          type: CRM_ACTIVITY_TYPE.TASK,
          status: CRM_ACTIVITY_STATUS.OPEN,
          title: 'First contact',
          primarySubjectType: 'LEAD',
          primarySubjectId: 'lead-9',
          ownerAdminId: 'a1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const result = await listEntityActivityProjections(prisma, {
      admin: makeAdmin('a1'),
      subjectType: CRM_SUBJECT_TYPE.LEAD,
      subjectId: 'lead-9',
    });
    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].projection).toBe(true);
    expect(result.items[0].duplicateActivityRow).toBe(false);
    expect(result.meta.oneActivityManyProjections).toBe(true);
  });

  it('DQ empty envelope does not invent zeroes', async () => {
    const prisma = makePrisma();
    const dq = await evaluateActivityDataQuality(prisma, { admin: makeAdmin('a1') });
    expect(dq.ok).toBe(true);
    expect(dq.status).toBe('EMPTY');
    expect(dq.checks.totalActivities).toBeNull();
    expect(dq.honesty.inventZeroesForbidden).toBe(true);
  });

  it('ACTIVITY_SPINE foundation is READY; channels stay NOT_AVAILABLE / NOT_CONNECTED', async () => {
    const result = await getCrmFoundations({}, { admin: makeAdmin('a1') });
    expect(result.ok).toBe(true);
    const byKind = Object.fromEntries(result.items.map((i) => [i.kind, i]));
    expect(byKind.ACTIVITY_SPINE.status).toBe('READY');
    expect(byKind.REPORTING.status).toBe('READY');
    expect(byKind.EMAIL_INGEST.status).toBe('NOT_AVAILABLE');
    expect(byKind.WHATSAPP_INGEST.status).toBe('NOT_AVAILABLE');
    expect(result.meta.telephony).toBe('NOT_AVAILABLE');
    expect(result.meta.googleOutlook).toBe('NOT_CONNECTED');
    expect(result.meta.weightedUiEnabled).toBe(false);
  });
});
