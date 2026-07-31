/**
 * Phase 14 Wave 4 — Delivery + attendance + recording gov + feedback + outcomes
 * + handoffs + reports + Phase 15 pack honesty contracts.
 * RSVP ≠ attendance; outcome ≠ auto Opportunity mutation; handoffs payload-only.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  CRM_CONSENT_STATUS,
  CRM_DEMO_ATTENDANCE_SOURCE,
  CRM_DEMO_ATTENDANCE_STATUS,
  CRM_DEMO_OUTCOME_CODE,
  CRM_DEMO_OUTCOME_COMPLETENESS,
  CRM_DEMO_RECORDING_GOV_STATUS,
  CRM_DEMO_REPORT_STATUS,
  CRM_DEMO_STATUS,
  CRM_FOUNDATION_KIND,
  CRM_FOUNDATION_STATUS,
  applyDemoReportHonesty,
  assertNoProposalOrTrialCreate,
  createDemo,
  createDemoFollowUp,
  createDemoReportSchedule,
  emitDemoProposalHandoff,
  emitDemoTrialHandoff,
  endDemoDelivery,
  getCrmFoundations,
  getDemoDomainContract,
  getDemoReport,
  recordDemoAttendance,
  recordDemoFeedbackResponse,
  recordDemoOutcome,
  recordLiveIssue,
  recordCustomerQuestion,
  requestDemoRecording,
  setDemoRecordingConsent,
  approveDemoRecording,
  denyDemoRecording,
  runDemoReportSchedule,
  startDemoDelivery,
  transitionDemoStatus,
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
          mergeLeads: true,
          manageConsent: true,
          activities: { view: true, edit: true },
          opportunities: { view: true, edit: true },
          ...crmPerms,
        },
      },
    },
  };
}

function makePrisma(overrides = {}) {
  const seqStore = overrides._seqStore || [];
  const demoStore = overrides._demoStore || [];
  const deliveryStore = overrides._deliveryStore || [];
  const issueStore = overrides._issueStore || [];
  const questionStore = overrides._questionStore || [];
  const attendanceStore = overrides._attendanceStore || [];
  const recordingStore = overrides._recordingStore || [];
  const feedbackStore = overrides._feedbackStore || [];
  const outcomeStore = overrides._outcomeStore || [];
  const handoffStore = overrides._handoffStore || [];
  const scheduleStore = overrides._scheduleStore || [];
  const runStore = overrides._runStore || [];
  const followUpStore = overrides._followUpStore || [];
  const activityStore = overrides._activityStore || [];
  const consentStore = overrides._consentStore || [];
  const timelineStore = overrides._timelineStore || [];
  const historyStore = overrides._historyStore || [];
  const participantStore = overrides._participantStore || [];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _demoStore: demoStore,
    _deliveryStore: deliveryStore,
    _attendanceStore: attendanceStore,
    _recordingStore: recordingStore,
    _outcomeStore: outcomeStore,
    _handoffStore: handoffStore,
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
    crmDemo: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return demoStore.find((r) => r.id === where.id) || null;
        if (where.demoNumber) {
          return demoStore.find((r) => r.demoNumber === where.demoNumber) || null;
        }
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `demo-${demoStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          readinessStatus: data.readinessStatus || 'NOT_READY',
          readinessJson: data.readinessJson ?? null,
          latestDeliverySessionId: data.latestDeliverySessionId ?? null,
          latestOutcomeId: data.latestOutcomeId ?? null,
          ...data,
        };
        demoStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = demoStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
      findMany: vi.fn(async () => [...demoStore]),
      count: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...demoStore];
        if (where.status) {
          if (where.status.in) {
            rows = rows.filter((r) => where.status.in.includes(r.status));
          } else {
            rows = rows.filter((r) => r.status === where.status);
          }
        }
        return rows.length;
      }),
    },
    crmDemoDeliverySession: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return deliveryStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return (
            deliveryStore.find((r) => r.idempotencyKey === where.idempotencyKey) ||
            null
          );
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {}, orderBy } = {}) => {
        let rows = [...deliveryStore];
        if (where.demoId) rows = rows.filter((r) => r.demoId === where.demoId);
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (orderBy?.startedAt === 'desc') {
          rows.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
        }
        return rows[0] || null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `del-${deliveryStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        deliveryStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = deliveryStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmDemoLiveIssue: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `iss-${issueStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        issueStore.push(row);
        return row;
      }),
    },
    crmDemoCustomerQuestion: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `q-${questionStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        questionStore.push(row);
        return row;
      }),
    },
    crmDemoAttendance: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.idempotencyKey) {
          return (
            attendanceStore.find((r) => r.idempotencyKey === where.idempotencyKey) ||
            null
          );
        }
        if (where.id) return attendanceStore.find((r) => r.id === where.id) || null;
        return null;
      }),
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
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...attendanceStore];
        if (where.demoId) rows = rows.filter((r) => r.demoId === where.demoId);
        return rows;
      }),
    },
    crmDemoParticipant: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return participantStore.find((r) => r.id === where.id) || null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = participantStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data);
        return row;
      }),
    },
    crmDemoRecordingGov: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.idempotencyKey) {
          return (
            recordingStore.find((r) => r.idempotencyKey === where.idempotencyKey) ||
            null
          );
        }
        if (where.id) return recordingStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...recordingStore];
        if (where.demoId) rows = rows.filter((r) => r.demoId === where.demoId);
        return rows[rows.length - 1] || null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `rec-${recordingStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          mediaFileId: null,
          ...data,
        };
        recordingStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = recordingStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmConsentRecord: {
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          consentStore.find(
            (r) => r.contactId === where.contactId && r.purpose === where.purpose
          ) || null
        );
      }),
      create: vi.fn(async ({ data }) => {
        const row = { id: `cons-${consentStore.length + 1}`, ...data };
        consentStore.push(row);
        return row;
      }),
    },
    crmDemoFeedbackResponse: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.idempotencyKey) {
          return (
            feedbackStore.find((r) => r.idempotencyKey === where.idempotencyKey) ||
            null
          );
        }
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `fb-${feedbackStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        feedbackStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...feedbackStore];
        if (where.demoId) rows = rows.filter((r) => r.demoId === where.demoId);
        return rows;
      }),
    },
    crmDemoOutcome: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.idempotencyKey) {
          return (
            outcomeStore.find((r) => r.idempotencyKey === where.idempotencyKey) ||
            null
          );
        }
        if (where.id) return outcomeStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...outcomeStore];
        if (where.demoId) rows = rows.filter((r) => r.demoId === where.demoId);
        return rows[rows.length - 1] || null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `out-${outcomeStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        outcomeStore.push(row);
        return row;
      }),
    },
    crmDemoHandoff: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.idempotencyKey) {
          return (
            handoffStore.find((r) => r.idempotencyKey === where.idempotencyKey) ||
            null
          );
        }
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `ho-${handoffStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        handoffStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...handoffStore];
        if (where.demoId) rows = rows.filter((r) => r.demoId === where.demoId);
        return rows;
      }),
    },
    crmDemoReportSchedule: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return scheduleStore.find((r) => r.id === where.id) || null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `sch-${scheduleStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          lastRunAt: null,
          lastRunStatus: null,
          ...data,
        };
        scheduleStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = scheduleStore.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      }),
      findMany: vi.fn(async () => [...scheduleStore]),
    },
    crmDemoReportRun: {
      create: vi.fn(async ({ data }) => {
        const row = { id: data.id || `run-${runStore.length + 1}`, ...data };
        runStore.push(row);
        return row;
      }),
    },
    crmFollowUp: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `fu-${followUpStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          autoExecuted: false,
          ...data,
        };
        followUpStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async () => null),
    },
    crmFollowUpHistory: {
      create: vi.fn(async ({ data }) => ({ id: `fuh-${Date.now()}`, ...data })),
    },
    crmActivity: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `act-${activityStore.length + 1}`,
          activityNumber: data.activityNumber || `ACT-2026-${String(activityStore.length + 1).padStart(6, '0')}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        activityStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = activityStore.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return activityStore.find((r) => r.id === where.id) || null;
      }),
    },
    crmActivityStatusHistory: {
      create: vi.fn(async ({ data }) => ({ id: `ash-${Date.now()}`, ...data })),
    },
    crmDemoStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `hist-${historyStore.length + 1}`, ...data };
        historyStore.push(row);
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
  };

  return prisma;
}

describe('Phase 14 Wave 4 — delivery / attendance / recording / outcome / handoffs / reports', () => {
  const admin = makeAdmin('admin-w4');

  async function readyDemo(prisma, extras = {}) {
    const created = await createDemo(prisma, {
      admin,
      title: 'Wave 4 Demo',
      leadId: 'lead-w4',
      opportunityId: 'opp-w4',
      contactId: 'contact-w4',
      ...extras,
    });
    // Force READY_TO_DELIVER for delivery tests (bypass readiness blockers)
    const row = prisma._demoStore.find((d) => d.id === created.demo.id);
    row.status = CRM_DEMO_STATUS.READY_TO_DELIVER;
    row.meetingId = 'meet-w4';
    row.contactId = 'contact-w4';
    return row;
  }

  it('starts and ends delivery; Meeting COMPLETED ≠ Demo DELIVERED contract', async () => {
    const prisma = makePrisma();
    const demo = await readyDemo(prisma);

    const started = await startDemoDelivery(prisma, {
      admin,
      demoId: demo.id,
      idempotencyKey: 'del-1',
      agendaCoverageJson: [{ item: 'intro', covered: true }],
    });
    expect(started.ok).toBe(true);
    expect(started.session.status).toBe('IN_PROGRESS');
    expect(started.demo.status).toBe(CRM_DEMO_STATUS.IN_DELIVERY);
    expect(started.domain.meetingCompletedEqualsDemoDelivered).toBe(false);

    const replay = await startDemoDelivery(prisma, {
      admin,
      demoId: demo.id,
      idempotencyKey: 'del-1',
    });
    expect(replay.idempotentReplay || replay.alreadyInDelivery).toBe(true);

    await recordLiveIssue(prisma, {
      admin,
      demoId: demo.id,
      summary: 'Login slow',
      severity: 'MEDIUM',
    });
    await recordCustomerQuestion(prisma, {
      admin,
      demoId: demo.id,
      question: 'Does payroll support MWK?',
      answer: 'Yes',
    });

    const ended = await endDemoDelivery(prisma, {
      admin,
      demoId: demo.id,
      sessionId: started.session.id,
    });
    expect(ended.ok).toBe(true);
    expect(ended.session.status).toBe('COMPLETED');
    expect(ended.demo.status).toBe(CRM_DEMO_STATUS.DELIVERED);
  });

  it('attendance is source-backed; RSVP invent forbidden', async () => {
    const prisma = makePrisma();
    const demo = await readyDemo(prisma);

    const bad = await recordDemoAttendance(prisma, {
      admin,
      demoId: demo.id,
      participantType: 'CONTACT',
      participantId: 'c1',
      attendanceStatus: CRM_DEMO_ATTENDANCE_STATUS.ATTENDED,
      fromRsvp: true,
    });
    expect(bad.ok).toBe(false);
    expect(bad.error).toBe('rsvp_equals_attendance_forbidden');

    const ok = await recordDemoAttendance(prisma, {
      admin,
      demoId: demo.id,
      participantType: 'CONTACT',
      participantId: 'c1',
      attendanceStatus: CRM_DEMO_ATTENDANCE_STATUS.ATTENDED,
      source: CRM_DEMO_ATTENDANCE_SOURCE.AUTHORISED_CONFIRMATION,
      idempotencyKey: 'att-1',
    });
    expect(ok.ok).toBe(true);
    expect(ok.attendance.source).toBe(
      CRM_DEMO_ATTENDANCE_SOURCE.AUTHORISED_CONFIRMATION
    );
    expect(ok.attendance.rsvpEqualsAttendance).toBe(false);

    const replay = await recordDemoAttendance(prisma, {
      admin,
      demoId: demo.id,
      participantType: 'CONTACT',
      participantId: 'c1',
      attendanceStatus: CRM_DEMO_ATTENDANCE_STATUS.ATTENDED,
      idempotencyKey: 'att-1',
    });
    expect(replay.idempotentReplay).toBe(true);
  });

  it('recording governance only; provider NOT_AVAILABLE; UNKNOWN ≠ GRANTED', async () => {
    const prisma = makePrisma();
    const demo = await readyDemo(prisma);

    const requested = await requestDemoRecording(prisma, {
      admin,
      demoId: demo.id,
      contactId: 'contact-w4',
      idempotencyKey: 'rec-req-1',
    });
    expect(requested.ok).toBe(true);
    expect(requested.providerStatus).toBe('NOT_AVAILABLE');
    expect(requested.mediaAvailable).toBe(false);
    expect(requested.recording.mediaFileId).toBeNull();
    expect(requested.recording.consentStatus).toBe(CRM_CONSENT_STATUS.UNKNOWN);

    const approveBlocked = await approveDemoRecording(prisma, {
      admin,
      demoId: demo.id,
    });
    expect(approveBlocked.ok).toBe(false);
    expect(approveBlocked.error).toBe('recording_consent_not_granted');

    const rsvpConsent = await setDemoRecordingConsent(prisma, {
      admin,
      demoId: demo.id,
      contactId: 'contact-w4',
      consentStatus: CRM_CONSENT_STATUS.GRANTED,
      fromRsvp: true,
    });
    expect(rsvpConsent.ok).toBe(false);
    expect(rsvpConsent.error).toBe('rsvp_equals_recording_consent_forbidden');

    const consented = await setDemoRecordingConsent(prisma, {
      admin,
      demoId: demo.id,
      contactId: 'contact-w4',
      consentStatus: CRM_CONSENT_STATUS.GRANTED,
    });
    expect(consented.ok).toBe(true);
    expect(consented.recording.status).toBe(
      CRM_DEMO_RECORDING_GOV_STATUS.CONSENT_GRANTED
    );

    const approved = await approveDemoRecording(prisma, {
      admin,
      demoId: demo.id,
    });
    expect(approved.ok).toBe(true);
    expect(approved.providerStatus).toBe('NOT_AVAILABLE');
    expect(approved.mediaStarted).toBe(false);
    expect(approved.recording.mediaFileId).toBeNull();
    expect(approved.recording.status).toBe(
      CRM_DEMO_RECORDING_GOV_STATUS.PROVIDER_NOT_AVAILABLE
    );

    const denied = await denyDemoRecording(prisma, {
      admin,
      demoId: demo.id,
      notes: 'Customer declined',
    });
    expect(denied.ok).toBe(true);
    expect(denied.recording.status).toBe(CRM_DEMO_RECORDING_GOV_STATUS.DENIED);
  });

  it('outcome completeness ≠ success; never auto-mutates Opportunity', async () => {
    const prisma = makePrisma();
    const demo = await readyDemo(prisma);
    demo.status = CRM_DEMO_STATUS.DELIVERED;

    const blocked = await recordDemoOutcome(prisma, {
      admin,
      demoId: demo.id,
      outcomeCode: CRM_DEMO_OUTCOME_CODE.POSITIVE,
      mutateOpportunity: true,
      updateStage: true,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toBe('auto_opportunity_mutation_forbidden');

    const recorded = await recordDemoOutcome(prisma, {
      admin,
      demoId: demo.id,
      outcomeCode: CRM_DEMO_OUTCOME_CODE.POSITIVE,
      completeness: CRM_DEMO_OUTCOME_COMPLETENESS.COMPLETE,
      // success omitted → false even when COMPLETE
      idempotencyKey: 'out-1',
    });
    expect(recorded.ok).toBe(true);
    expect(recorded.outcome.completeness).toBe(
      CRM_DEMO_OUTCOME_COMPLETENESS.COMPLETE
    );
    expect(recorded.outcome.success).toBe(false);
    expect(recorded.opportunityMutated).toBe(false);
    expect(recorded.stageChanged).toBe(false);
    expect(recorded.demo.status).toBe(CRM_DEMO_STATUS.OUTCOME_RECORDED);

    const withSuccess = await recordDemoOutcome(prisma, {
      admin,
      demoId: demo.id,
      outcomeCode: CRM_DEMO_OUTCOME_CODE.NEUTRAL,
      completeness: CRM_DEMO_OUTCOME_COMPLETENESS.PARTIAL,
      success: true,
      idempotencyKey: 'out-2',
    });
    expect(withSuccess.ok).toBe(true);
    expect(withSuccess.outcome.success).toBe(true);
    expect(withSuccess.outcome.completeness).toBe(
      CRM_DEMO_OUTCOME_COMPLETENESS.PARTIAL
    );
  });

  it('Proposal/Trial handoffs are idempotent payloads only', async () => {
    const prisma = makePrisma();
    const demo = await readyDemo(prisma);
    demo.status = CRM_DEMO_STATUS.OUTCOME_RECORDED;
    demo.latestOutcomeId = 'out-x';

    const createBlocked = await emitDemoProposalHandoff(prisma, {
      admin,
      demoId: demo.id,
      createProposal: true,
    });
    expect(createBlocked.ok).toBe(false);
    expect(createBlocked.error).toBe('handoff_create_forbidden');

    const proposal = await emitDemoProposalHandoff(prisma, {
      admin,
      demoId: demo.id,
      idempotencyKey: 'ho-p-1',
    });
    expect(proposal.ok).toBe(true);
    expect(proposal.proposalCreated).toBe(false);
    expect(proposal.handoffPayload.proposalId).toBeNull();
    expect(assertNoProposalOrTrialCreate(proposal)).toBe(true);

    const proposalReplay = await emitDemoProposalHandoff(prisma, {
      admin,
      demoId: demo.id,
      idempotencyKey: 'ho-p-1',
    });
    expect(proposalReplay.idempotentReplay).toBe(true);

    const trial = await emitDemoTrialHandoff(prisma, {
      admin,
      demoId: demo.id,
      idempotencyKey: 'ho-t-1',
    });
    expect(trial.ok).toBe(true);
    expect(trial.trialCreated).toBe(false);
    expect(trial.tenantCreated).toBe(false);
    expect(trial.handoffPayload.tenantId).toBeNull();
    expect(assertNoProposalOrTrialCreate(trial)).toBe(true);
  });

  it('Follow-Up via Phase 13; reports honesty-gated; schedules audited', async () => {
    const prisma = makePrisma();
    const demo = await readyDemo(prisma);
    demo.status = CRM_DEMO_STATUS.OUTCOME_RECORDED;

    const fu = await createDemoFollowUp(prisma, {
      admin,
      demoId: demo.id,
      title: 'Send proposal draft',
      dueAt: new Date('2026-08-01T10:00:00Z'),
    });
    expect(fu.ok).toBe(true);
    expect(fu.followUp).toBeTruthy();
    expect(fu.autoExecuted).toBe(false);

    const emptyHonesty = applyDemoReportHonesty({ modelAvailable: false });
    expect(emptyHonesty.status).toBe(CRM_DEMO_REPORT_STATUS.UNAVAILABLE);
    expect(emptyHonesty.inventZeroesForbidden).toBe(true);
    expect(emptyHonesty.falseZeroes).toBe(false);

    const emptyReport = await getDemoReport(prisma, { admin });
    // one demo exists → READY with honest counts
    expect(emptyReport.ok).toBe(true);
    expect(emptyReport.honesty.inventZeroesForbidden).toBe(true);
    expect(emptyReport.report.leadDemoRequestNotUsedAsVolume).toBe(true);

    const prismaEmpty = makePrisma();
    const noDemos = await getDemoReport(prismaEmpty, { admin });
    expect(noDemos.status).toBe(CRM_DEMO_REPORT_STATUS.EMPTY);
    expect(noDemos.report.kpis.total).toBe(0);

    const unavailable = await getDemoReport(
      {},
      { admin: makeAdmin('no-view', { view: false, viewLeads: false, editLeads: false, activities: { view: false, edit: false }, opportunities: { view: false, edit: false } }) }
    );
    expect(unavailable.forbidden || unavailable.status === CRM_DEMO_REPORT_STATUS.UNAVAILABLE).toBe(
      true
    );

    const schedule = await createDemoReportSchedule(prisma, {
      admin,
      name: 'Weekly Demo KPIs',
      cronExpression: '0 9 * * 1',
    });
    expect(schedule.ok).toBe(true);
    expect(schedule.meta.audited).toBe(true);

    const run = await runDemoReportSchedule(prisma, {
      admin,
      scheduleId: schedule.schedule.id,
    });
    expect(run.ok).toBe(true);
    expect(run.meta.audited).toBe(true);
    expect(run.meta.inventZeroesForbidden).toBe(true);
    expect(run.run).toBeTruthy();
  });

  it('feedback response optional; domain contract wave 4 + DEMO_SPINE READY', async () => {
    const prisma = makePrisma();
    const demo = await readyDemo(prisma);

    const fb = await recordDemoFeedbackResponse(prisma, {
      admin,
      demoId: demo.id,
      score: 4,
      responses: { nps: 4, comment: 'Clear' },
      idempotencyKey: 'fb-1',
    });
    expect(fb.ok).toBe(true);
    expect(fb.inventScoresForbidden).toBe(true);

    const contract = getDemoDomainContract();
    expect(contract.wave).toBe(4);
    expect(contract.recordingProvider).toBe('NOT_AVAILABLE');
    expect(contract.inventRecordingFileForbidden).toBe(true);
    expect(contract.autoOpportunityStageMutationForbidden).toBe(true);
    expect(contract.completenessEqualsSuccessForbidden).toBe(true);
    expect(contract.handoffPayloadOnly).toBe(true);
    expect(contract.inventReportZeroesForbidden).toBe(true);
    expect(contract.rsvpEqualsAttendance).toBe(false);

    const foundations = await getCrmFoundations(prisma, { admin });
    const demoSpine = foundations.items.find(
      (f) => f.kind === CRM_FOUNDATION_KIND.DEMO_SPINE
    );
    expect(demoSpine.status).toBe(CRM_FOUNDATION_STATUS.READY);
  });

  it('Wave 4 status transitions open from READY_TO_DELIVER', async () => {
    const prisma = makePrisma();
    const demo = await readyDemo(prisma);
    const t = await transitionDemoStatus(prisma, {
      admin,
      demoId: demo.id,
      toStatus: CRM_DEMO_STATUS.IN_DELIVERY,
      reason: 'manual',
    });
    expect(t.ok).toBe(true);
    expect(t.demo.status).toBe(CRM_DEMO_STATUS.IN_DELIVERY);
  });
});
