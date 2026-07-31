/**
 * Phase 13 Wave 2 — Calls + Email (SMTP) + email template foundations.
 * Telephony/recording NOT_AVAILABLE; SMTP accept ≠ delivered; no pixels/opens/replies invent.
 * Fail-closed when Activity create fails (match Wave 1 Task).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CRM_ACTIVITY_TYPE,
  CRM_ACTIVITY_STATUS,
  CRM_ACTIVITY_DIRECTION,
  CRM_CALL_STATUS,
  CRM_CALL_OUTCOME,
  CRM_CALL_NUMBER_RE,
  CRM_EMAIL_ACTIVITY_STATUS,
  CRM_EMAIL_SEND_STATUS,
  CRM_EMAIL_TEMPLATE_STATUS,
  CRM_TELEPHONY_PROVIDER_STATUS,
  CRM_CALL_RECORDING_STATUS,
  allocateCallNumber,
  planCall,
  logManualCall,
  completeCall,
  createEmailDraft,
  evaluateEmailSendEligibility,
  requestEmailSend,
  createEmailTemplateVersion,
  renderEmailTemplateSafe,
  getTelephonyProviderContract,
  getCallRecordingStatus,
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
  const callStore = overrides._callStore || [];
  const emailStore = overrides._emailStore || [];
  const sendStore = overrides._sendStore || [];
  const deliveryStore = overrides._deliveryStore || [];
  const templateStore = overrides._templateStore || [];
  const timelineStore = overrides._timelineStore || [];
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
    crmCall: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `call-${callStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          completedAt: data.completedAt ?? null,
          scheduledAt: data.scheduledAt ?? null,
          outcome: data.outcome ?? null,
          consentBlocked: data.consentBlocked === true,
          eligibilityJson: data.eligibilityJson ?? null,
          ...data,
        };
        callStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return callStore.find((r) => r.id === where.id) || null;
        if (where.callNumber) {
          return callStore.find((r) => r.callNumber === where.callNumber) || null;
        }
        if (where.idempotencyKey) {
          return callStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...callStore];
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.subjectId) rows = rows.filter((r) => r.subjectId === where.subjectId);
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = callStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmEmailActivity: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `em-${emailStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          consentBlocked: data.consentBlocked === true,
          eligibilityJson: data.eligibilityJson ?? null,
          ...data,
        };
        emailStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return emailStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return emailStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      findMany: vi.fn(async () => [...emailStore]),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = emailStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmEmailSendRequest: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `sr-${sendStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          completedAt: data.completedAt ?? null,
          providerMessageId: data.providerMessageId ?? null,
          providerResponse: data.providerResponse ?? null,
          error: data.error ?? null,
          ...data,
        };
        sendStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return sendStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return sendStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = sendStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      }),
    },
    crmEmailDeliveryEvent: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `de-${deliveryStore.length + 1}`, ...data };
        deliveryStore.push(row);
        return row;
      }),
    },
    crmEmailTemplate: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `tpl-${templateStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        templateStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {}, orderBy } = {}) => {
        let rows = [...templateStore];
        if (where.code) rows = rows.filter((r) => r.code === where.code);
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.version != null) rows = rows.filter((r) => r.version === where.version);
        if (orderBy?.version === 'desc') {
          rows.sort((a, b) => b.version - a.version);
        }
        return rows[0] || null;
      }),
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
      callStore,
      emailStore,
      sendStore,
      deliveryStore,
      templateStore,
      timelineStore,
      consentStore,
      dncStore,
    },
  };

  return prisma;
}

describe('CRM Activity Wave 2 — telephony boundary', () => {
  it('exposes telephony and recording as NOT_AVAILABLE', () => {
    const tel = getTelephonyProviderContract();
    expect(tel.status).toBe(CRM_TELEPHONY_PROVIDER_STATUS);
    expect(tel.recording).toBe(CRM_CALL_RECORDING_STATUS);
    expect(tel.liveDial).toBe(false);
    expect(getCallRecordingStatus()).toBe('NOT_AVAILABLE');
  });
});

describe('CRM Activity Wave 2 — Call numbering + plan/log', () => {
  it('allocates CALL-YYYY-###### and plans/logs without fabricating connect/recording', async () => {
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
    const admin = makeAdmin('a1', { viewLeads: true, editLeads: true });

    const n1 = await allocateCallNumber(prisma, {
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(n1.ok).toBe(true);
    expect(n1.number).toMatch(CRM_CALL_NUMBER_RE);
    expect(n1.number).toBe('CALL-2026-000001');

    const planned = await planCall(prisma, {
      admin,
      direction: CRM_ACTIVITY_DIRECTION.OUTBOUND,
      title: 'Discovery dial',
      subjectType: 'LEAD',
      subjectId: 'lead-1',
      contactId: 'con-ok',
      scheduledAt: new Date('2026-08-05T10:00:00.000Z'),
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(planned.ok).toBe(true);
    expect(planned.call.callNumber).toMatch(CRM_CALL_NUMBER_RE);
    expect(planned.call.status).toBe(CRM_CALL_STATUS.PLANNED);
    expect(planned.call.telephonyConnected).toBe(false);
    expect(planned.call.recordingStatus).toBe('NOT_AVAILABLE');
    expect(planned.activity?.type).toBe(CRM_ACTIVITY_TYPE.CALL);
    expect(planned.telephony.status).toBe('NOT_AVAILABLE');

    const logged = await logManualCall(prisma, {
      admin,
      direction: CRM_ACTIVITY_DIRECTION.OUTBOUND,
      title: 'Spoke with prospect',
      subjectType: 'LEAD',
      subjectId: 'lead-1',
      contactId: 'con-ok',
      outcome: CRM_CALL_OUTCOME.CONNECTED_MANUAL,
      completedAt: new Date('2026-07-29T15:00:00.000Z'),
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(logged.ok).toBe(true);
    expect(logged.call.status).toBe(CRM_CALL_STATUS.COMPLETED);
    expect(logged.call.outcome).toBe(CRM_CALL_OUTCOME.CONNECTED_MANUAL);
    expect(logged.call.telephonyConnected).toBe(false);
    expect(logged.activity?.status).toBe(CRM_ACTIVITY_STATUS.COMPLETED);
  });

  it('blocks future Call logged as completed and enforces DNC/consent', async () => {
    const prisma = makePrisma({
      _dncStore: [
        {
          contactId: 'con-dnc',
          flag: 'DO_NOT_CALL',
          active: true,
          source: 'manual',
        },
      ],
    });
    const admin = superAdmin();

    const future = await logManualCall(prisma, {
      admin,
      title: 'Future call',
      subjectType: 'LEAD',
      subjectId: 'lead-f',
      completedAt: new Date('2026-12-01T12:00:00.000Z'),
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(future.ok).toBe(false);
    expect(future.error).toBe('future_call_cannot_be_completed');
    expect(prisma.crmCall.create).not.toHaveBeenCalled();

    const dnc = await planCall(prisma, {
      admin,
      title: 'Should block',
      subjectType: 'LEAD',
      subjectId: 'lead-dnc',
      contactId: 'con-dnc',
      direction: CRM_ACTIVITY_DIRECTION.OUTBOUND,
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(dnc.ok).toBe(true);
    expect(dnc.call.status).toBe(CRM_CALL_STATUS.BLOCKED_BY_CONSENT);
    expect(dnc.call.consentBlocked).toBe(true);
    expect(dnc.activity.status).toBe(CRM_ACTIVITY_STATUS.BLOCKED_BY_CONSENT);
  });

  it('completes planned Call idempotently and fail-closes when Activity create fails', async () => {
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
    const admin = makeAdmin('ed-1', { viewLeads: true, editLeads: true });

    const planned = await planCall(prisma, {
      admin,
      title: 'Complete me',
      subjectType: 'OPPORTUNITY',
      subjectId: 'opp-1',
      contactId: 'con-ok',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(planned.ok).toBe(true);

    const done = await completeCall(prisma, {
      admin,
      callId: planned.call.id,
      outcome: CRM_CALL_OUTCOME.NO_ANSWER,
      now: new Date('2026-07-30T13:00:00.000Z'),
    });
    expect(done.ok).toBe(true);
    expect(done.call.status).toBe(CRM_CALL_STATUS.COMPLETED);

    const again = await completeCall(prisma, {
      admin,
      callId: planned.call.id,
      outcome: CRM_CALL_OUTCOME.BUSY,
    });
    expect(again.ok).toBe(true);
    expect(again.alreadyCompleted).toBe(true);
    expect(again.call.outcome).toBe(CRM_CALL_OUTCOME.NO_ANSWER);

    // Activity model present; ACT numbering fails after CALL number allocates → no orphan Call
    const broken = makePrisma({
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

    const orphan = await planCall(broken, {
      admin,
      title: 'Must not orphan call',
      subjectType: 'LEAD',
      subjectId: 'lead-orphan',
      contactId: 'con-ok',
      now: new Date('2026-07-30T14:00:00.000Z'),
    });
    expect(orphan.ok).toBe(false);
    expect(orphan.error).toBeTruthy();
    expect(broken.crmCall.create).not.toHaveBeenCalled();
  });

  it('fail-closes outbound Call plan/log/complete when contactId omitted', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const now = new Date('2026-07-30T12:00:00.000Z');

    const planned = await planCall(prisma, {
      admin,
      title: 'No contact plan',
      subjectType: 'LEAD',
      subjectId: 'lead-nc',
      direction: CRM_ACTIVITY_DIRECTION.OUTBOUND,
      now,
    });
    expect(planned.ok).toBe(false);
    expect(planned.error).toBe('CONTACT_REQUIRED');
    expect(prisma.crmCall.create).not.toHaveBeenCalled();

    const logged = await logManualCall(prisma, {
      admin,
      title: 'No contact log',
      subjectType: 'LEAD',
      subjectId: 'lead-nc',
      direction: CRM_ACTIVITY_DIRECTION.OUTBOUND,
      outcome: CRM_CALL_OUTCOME.CONNECTED_MANUAL,
      completedAt: new Date('2026-07-29T15:00:00.000Z'),
      now,
    });
    expect(logged.ok).toBe(false);
    expect(logged.error).toBe('CONTACT_REQUIRED');
    expect(prisma.crmCall.create).not.toHaveBeenCalled();

    // Legacy/seeded outbound PLANNED row without contact must not complete-as-connected
    prisma._stores.callStore.push({
      id: 'call-no-contact',
      callNumber: 'CALL-2026-009999',
      activityId: null,
      direction: CRM_ACTIVITY_DIRECTION.OUTBOUND,
      status: CRM_CALL_STATUS.PLANNED,
      outcome: null,
      contactId: null,
      subjectType: 'LEAD',
      subjectId: 'lead-nc',
      phoneNumber: null,
      scheduledAt: null,
      completedAt: null,
      consentBlocked: false,
      eligibilityJson: null,
      notes: null,
      ownerAdminId: admin.id,
      createdByAdminId: admin.id,
      idempotencyKey: null,
      createdAt: now,
      updatedAt: now,
    });
    const done = await completeCall(prisma, {
      admin,
      callId: 'call-no-contact',
      outcome: CRM_CALL_OUTCOME.CONNECTED_MANUAL,
      now: new Date('2026-07-30T13:00:00.000Z'),
    });
    expect(done.ok).toBe(false);
    expect(done.error).toBe('CONTACT_REQUIRED');
    expect(prisma._stores.callStore[0].status).toBe(CRM_CALL_STATUS.PLANNED);
  });
});

describe('CRM Activity Wave 2 — Email draft / eligibility / SMTP send', () => {
  it('drafts, checks eligibility, sends via SMTP adapter, retries idempotent', async () => {
    const prisma = makePrisma({
      _consentStore: [
        {
          contactId: 'con-mail',
          purpose: 'SALES_CONTACT',
          status: 'GRANTED',
          source: 'explicit',
          createdAt: new Date('2026-01-01'),
        },
      ],
    });
    const admin = makeAdmin('mail-1', { viewLeads: true, editLeads: true });

    const draft = await createEmailDraft(prisma, {
      admin,
      toAddress: 'prospect@example.com',
      subject: 'Hello from Sales',
      bodyText: 'Plain body — no pixel',
      bodyHtml: '<p>Hello</p>',
      subjectType: 'LEAD',
      subjectId: 'lead-mail',
      contactId: 'con-mail',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(draft.ok).toBe(true);
    expect(draft.email.status).toBe(CRM_EMAIL_ACTIVITY_STATUS.DRAFT);
    expect(draft.email.trackingPixels).toBe(false);
    expect(draft.activity?.type).toBe(CRM_ACTIVITY_TYPE.EMAIL);

    const elig = await evaluateEmailSendEligibility(prisma, {
      contactId: 'con-mail',
      purpose: 'SALES_CONTACT',
    });
    expect(elig.eligible).toBe(true);

    const sendFn = vi.fn(async () => ({
      ok: true,
      mappedStatus: CRM_EMAIL_SEND_STATUS.SENT,
      messageId: 'smtp-msg-1',
      response: '250 OK',
      accepted: ['prospect@example.com'],
      rejected: [],
      error: null,
      delivered: false,
    }));

    const sent = await requestEmailSend(
      prisma,
      {
        admin,
        emailActivityId: draft.email.id,
        idempotencyKey: 'send-key-1',
        now: new Date('2026-07-30T12:05:00.000Z'),
      },
      { sendFn }
    );
    expect(sent.ok).toBe(true);
    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(sent.sendRequest.status).toBe(CRM_EMAIL_SEND_STATUS.SENT);
    expect(sent.delivered).toBe(false);
    expect(sent.opens).toBeNull();
    expect(sent.replies).toBeNull();
    expect(sent.email.status).toBe(CRM_EMAIL_ACTIVITY_STATUS.SENT);
    expect(prisma._stores.deliveryStore[0].eventType).toBe('SENT');
    expect(prisma._stores.deliveryStore[0].evidenceJson.delivered).toBe(false);

    const retry = await requestEmailSend(
      prisma,
      {
        admin,
        emailActivityId: draft.email.id,
        idempotencyKey: 'send-key-1',
      },
      { sendFn }
    );
    expect(retry.ok).toBe(true);
    expect(retry.alreadyExists).toBe(true);
    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(retry.delivered).toBe(false);
  });

  it('blocks UNKNOWN consent without SMTP and never invents delivered', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const draft = await createEmailDraft(prisma, {
      admin,
      toAddress: 'unknown@example.com',
      subject: 'Should block',
      bodyText: 'hi',
      subjectType: 'LEAD',
      subjectId: 'lead-u',
      contactId: 'con-unknown',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(draft.ok).toBe(true);
    expect(draft.email.status).toBe(CRM_EMAIL_ACTIVITY_STATUS.BLOCKED_BY_CONSENT);

    const sendFn = vi.fn(async () => ({
      ok: true,
      mappedStatus: CRM_EMAIL_SEND_STATUS.SENT,
      messageId: 'should-not-run',
      delivered: false,
    }));

    const blocked = await requestEmailSend(
      prisma,
      {
        admin,
        emailActivityId: draft.email.id,
        idempotencyKey: 'blocked-key',
      },
      { sendFn }
    );
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toBe('email_blocked_by_consent');
    expect(blocked.smtpCalled).not.toBe(true);
    expect(sendFn).not.toHaveBeenCalled();
  });

  it('fail-closes Email send when contactId omitted (no SMTP)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();

    const draft = await createEmailDraft(prisma, {
      admin,
      toAddress: 'orphan@example.com',
      subject: 'No contact send',
      bodyText: 'should not send',
      subjectType: 'LEAD',
      subjectId: 'lead-no-contact',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(draft.ok).toBe(true);
    expect(draft.email.contactId).toBeNull();
    expect(draft.email.status).toBe(CRM_EMAIL_ACTIVITY_STATUS.DRAFT);

    const sendFn = vi.fn(async () => ({
      ok: true,
      mappedStatus: CRM_EMAIL_SEND_STATUS.SENT,
      messageId: 'must-not-run',
      delivered: false,
    }));

    const sent = await requestEmailSend(
      prisma,
      {
        admin,
        emailActivityId: draft.email.id,
        idempotencyKey: 'no-contact-send',
      },
      { sendFn }
    );
    expect(sent.ok).toBe(false);
    expect(sent.error).toBe('CONTACT_REQUIRED');
    expect(sent.smtpCalled).toBe(false);
    expect(sendFn).not.toHaveBeenCalled();
    expect(prisma.crmEmailSendRequest.create).not.toHaveBeenCalled();
  });

  it('fail-closes Email draft when Activity create fails', async () => {
    const prisma = makePrisma();
    const realCreate = prisma.crmNumberSeq.create;
    prisma.crmNumberSeq.findUnique = vi.fn(async ({ where = {} } = {}) => {
      const key = where.prefix_year || where;
      if (key.prefix === 'ACT') {
        return { prefix: 'ACT', year: key.year, lastIssued: 1 };
      }
      return null;
    });
    prisma.crmNumberSeq.updateMany = vi.fn(async () => ({ count: 0 }));
    prisma.crmNumberSeq.create = vi.fn(async ({ data }) => {
      if (data.prefix === 'ACT') {
        const err = Object.assign(new Error('fail'), { code: 'P2002' });
        throw err;
      }
      return realCreate({ data });
    });

    const admin = makeAdmin('em-fail', { viewLeads: true, editLeads: true });
    const result = await createEmailDraft(prisma, {
      admin,
      toAddress: 'x@example.com',
      subject: 'orphan?',
      bodyText: 'no',
      subjectType: 'LEAD',
      subjectId: 'lead-x',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(result.ok).toBe(false);
    expect(prisma.crmEmailActivity.create).not.toHaveBeenCalled();
  });
});

describe('CRM Activity Wave 2 — email template foundations', () => {
  it('renders allowlisted vars only and rejects executable expressions', async () => {
    expect(
      renderEmailTemplateSafe('Hi {{contactName}}', { contactName: 'Ada' })
    ).toBe('Hi Ada');
    expect(
      renderEmailTemplateSafe('Hi {{evil}}', { evil: 'nope' })
    ).toBe('Hi {{evil}}');
    expect(() =>
      renderEmailTemplateSafe('Hi ${contactName}', { contactName: 'x' })
    ).toThrow(/executable/i);

    const prisma = makePrisma();
    const admin = makeAdmin('tpl-1', { viewLeads: true, editLeads: true });
    const created = await createEmailTemplateVersion(prisma, {
      admin,
      code: 'SALES_INTRO',
      status: CRM_EMAIL_TEMPLATE_STATUS.ACTIVE,
      subjectTemplate: 'Hello {{contactName}}',
      bodyTextTemplate: 'From {{ownerName}}',
      bodyHtmlTemplate: '<p>Hi {{contactName}}</p>',
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(created.ok).toBe(true);
    expect(created.executableExpressions).toBe(false);
    expect(created.template.version).toBe(1);
  });
});
