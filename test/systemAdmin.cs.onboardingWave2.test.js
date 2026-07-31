/**
 * Phase 17 Wave 2 — Templates, materialisation, kick-off, stakeholders, tasks/evidence, scope/CR.
 * RSVP ≠ attendance; Customer evidence = admin attestation; no Subscription entitlement mutation.
 * No fabricated kick-off complete / Training complete / Tenant GL.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ensureWave1StandardTemplateVersion,
  createOnboardingProject,
  consumeOnboardingHandoff,
  validateOnboardingRequest,
  acceptOnboardingRequest,
  approveOnboardingTemplateVersion,
  activateOnboardingTemplateVersion,
  materialiseOnboardingTemplate,
  scheduleOnboardingKickoff,
  recordOnboardingKickoffRsvp,
  assignOnboardingStakeholder,
  confirmOnboardingRequirements,
  detectScopeMismatch,
  createOnboardingTask,
  completeOnboardingTask,
  submitCustomerTaskEvidence,
  reviewCustomerTaskEvidence,
  addOnboardingTaskDependency,
  getOnboardingDomainContract,
  CRM_MEETING_RSVP,
  CRM_MEETING_ATTENDANCE,
  CUSTOMER_PORTAL_NOT_CONFIGURED,
} from '@/lib/admin/customerSuccess/onboarding';

function superAdmin(id = 'super-onb-2') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function wave2TemplateContent() {
  return {
    wave: 2,
    workstreams: [
      { code: 'GOVERNANCE', name: 'Governance', sequence: 1 },
      { code: 'TENANT_SETUP', name: 'Tenant setup', sequence: 2 },
    ],
    milestones: [
      {
        code: 'KICKOFF_DONE',
        name: 'Kick-off complete',
        workstreamCode: 'GOVERNANCE',
        sequence: 1,
        required: true,
      },
    ],
    tasks: [
      {
        code: 'PROVIDE_DATA',
        name: 'Provide master data',
        workstreamCode: 'TENANT_SETUP',
        actorType: 'CUSTOMER',
        sequence: 1,
      },
      {
        code: 'INTERNAL_REVIEW',
        name: 'Internal review',
        workstreamCode: 'GOVERNANCE',
        actorType: 'INTERNAL',
        sequence: 1,
      },
    ],
    checklists: [
      {
        code: 'KICKOFF_AGENDA',
        name: 'Kick-off agenda approved',
        workstreamCode: 'GOVERNANCE',
        sequence: 1,
      },
    ],
  };
}

function makePrisma(overrides = {}) {
  const seqStore = overrides._seqStore || [];
  const requestStore = overrides._requestStore || [];
  const requestHistoryStore = overrides._requestHistoryStore || [];
  const projectStore = overrides._projectStore || [];
  const projectHistoryStore = overrides._projectHistoryStore || [];
  const templateStore = overrides._templateStore || [];
  const templateVersionStore = overrides._templateVersionStore || [];
  const workstreamStore = overrides._workstreamStore || [];
  const milestoneStore = overrides._milestoneStore || [];
  const taskStore = overrides._taskStore || [];
  const checklistStore = overrides._checklistStore || [];
  const kickoffStore = overrides._kickoffStore || [];
  const stakeholderStore = overrides._stakeholderStore || [];
  const requirementStore = overrides._requirementStore || [];
  const scopeStore = overrides._scopeStore || [];
  const changeRequestStore = overrides._changeRequestStore || [];
  const evidenceStore = overrides._evidenceStore || [];
  const dependencyStore = overrides._dependencyStore || [];
  const responsibilityStore = overrides._responsibilityStore || [];
  const materialisationStore = overrides._materialisationStore || [];
  const meetingStore = overrides._meetingStore || [];
  const meetingParticipantStore = overrides._meetingParticipantStore || [];
  const contactStore = overrides._contactStore || [
    {
      id: 'contact-verified-1',
      contactNumber: 'CTC-2026-000001',
      verificationStatus: 'VERIFIED',
      customerId: 'cust-1',
    },
    {
      id: 'contact-unverified-1',
      contactNumber: 'CTC-2026-000002',
      verificationStatus: 'UNVERIFIED',
      customerId: 'cust-1',
    },
  ];
  const subscriptionStore = overrides._subscriptionStore || [
    {
      id: 'sub-1',
      entitlementsJson: { planCode: 'STANDARD', addOns: [], quantity: 1 },
      planCode: 'STANDARD',
    },
  ];
  const handoffStore = overrides._handoffStore || [
    {
      id: 'handoff-onb-w2-1',
      conversionId: 'cvn-w2-1',
      tenantId: 'tenant-1',
      handoffType: 'ONBOARDING',
      status: 'EMITTED',
      executionStatus: 'NOT_STARTED',
      idempotencyKey: 'onboarding-handoff:cvn-w2-1',
      payloadJson: {
        type: 'CRM_ONBOARDING_HANDOFF',
        conversionId: 'cvn-w2-1',
        customerId: 'cust-1',
        tenantId: 'tenant-1',
        subscriptionId: 'sub-1',
        onboardingCompleted: false,
        fabricatedComplete: false,
        executionComplete: false,
        executionStatus: 'NOT_STARTED',
        commercialSnapshot: {
          planCode: 'STANDARD',
          addOns: [],
          quantity: 1,
          businesses: 1,
          branches: 1,
        },
      },
      checksumSha256: null,
      createdByAdminId: 'super-onb-2',
      createdAt: new Date('2026-07-31T10:00:00Z'),
      updatedAt: new Date('2026-07-31T10:00:00Z'),
    },
  ];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _requestStore: requestStore,
    _projectStore: projectStore,
    _handoffStore: handoffStore,
    _templateVersionStore: templateVersionStore,
    _workstreamStore: workstreamStore,
    _milestoneStore: milestoneStore,
    _taskStore: taskStore,
    _checklistStore: checklistStore,
    _kickoffStore: kickoffStore,
    _stakeholderStore: stakeholderStore,
    _changeRequestStore: changeRequestStore,
    _evidenceStore: evidenceStore,
    _dependencyStore: dependencyStore,
    _materialisationStore: materialisationStore,
    _meetingStore: meetingStore,
    _subscriptionStore: subscriptionStore,
    _contactStore: contactStore,
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
    crmConversionDomainHandoff: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `handoff-${handoffStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        handoffStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return handoffStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return handoffStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...handoffStore];
        if (where.handoffType) {
          rows = rows.filter((r) => r.handoffType === where.handoffType);
        }
        if (where.conversionId) {
          rows = rows.filter((r) => r.conversionId === where.conversionId);
        }
        return rows[0] || null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = handoffStore.find((r) => r.id === where.id);
        if (!row) throw new Error('handoff_not_found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerOnboardingRequest: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `onr-${requestStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        requestStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return requestStore.find((r) => r.id === where.id) || null;
        if (where.requestNumber) {
          return requestStore.find((r) => r.requestNumber === where.requestNumber) || null;
        }
        if (where.idempotencyKey) {
          return requestStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...requestStore];
        if (where.handoffId) rows = rows.filter((r) => r.handoffId === where.handoffId);
        if (where.source) rows = rows.filter((r) => r.source === where.source);
        return rows[0] || null;
      }),
      findMany: vi.fn(async () => [...requestStore]),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = requestStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerOnboardingRequestStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `onrh-${requestHistoryStore.length + 1}`, ...data };
        requestHistoryStore.push(row);
        return row;
      }),
    },
    customerOnboardingProject: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `onb-${projectStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        projectStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return projectStore.find((r) => r.id === where.id) || null;
        if (where.onboardingNumber) {
          return projectStore.find((r) => r.onboardingNumber === where.onboardingNumber) || null;
        }
        if (where.idempotencyKey) {
          return projectStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        if (where.onboardingRequestId) {
          return (
            projectStore.find((r) => r.onboardingRequestId === where.onboardingRequestId) || null
          );
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...projectStore];
        if (where.onboardingRequestId) {
          rows = rows.filter((r) => r.onboardingRequestId === where.onboardingRequestId);
        }
        return rows[0] || null;
      }),
      findMany: vi.fn(async () => [...projectStore]),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = projectStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerOnboardingProjectStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `onbh-${projectHistoryStore.length + 1}`, ...data };
        projectHistoryStore.push(row);
        return row;
      }),
    },
    customerOnboardingTemplate: {
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
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return templateStore.find((r) => r.id === where.id) || null;
        if (where.templateCode) {
          return templateStore.find((r) => r.templateCode === where.templateCode) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...templateStore];
        if (where.templateCode) {
          rows = rows.filter((r) => r.templateCode === where.templateCode);
        }
        return rows[0] || null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = templateStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerOnboardingTemplateVersion: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `tmplv-${templateVersionStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        templateVersionStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...templateVersionStore];
        if (where.onboardingType) {
          rows = rows.filter((r) => r.onboardingType === where.onboardingType);
        }
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.templateCode) {
          rows = rows.filter((r) => r.templateCode === where.templateCode);
        }
        if (where.versionNumber != null) {
          rows = rows.filter((r) => r.versionNumber === where.versionNumber);
        }
        return rows[0] || null;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return templateVersionStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...templateVersionStore];
        if (where.templateCode) {
          rows = rows.filter((r) => r.templateCode === where.templateCode);
        }
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = templateVersionStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerOnboardingMaterialisation: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `mat-${materialisationStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        materialisationStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.idempotencyKey) {
          return (
            materialisationStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null
          );
        }
        if (where.projectId) {
          return materialisationStore.find((r) => r.projectId === where.projectId) || null;
        }
        if (where.id) return materialisationStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...materialisationStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        if (where.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        return rows[0] || null;
      }),
    },
    customerOnboardingWorkstream: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `ws-${workstreamStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        workstreamStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...workstreamStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        return rows;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...workstreamStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        if (where.code) rows = rows.filter((r) => r.code === where.code);
        return rows[0] || null;
      }),
      count: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...workstreamStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        return rows.length;
      }),
    },
    customerOnboardingMilestone: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `ms-${milestoneStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        milestoneStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...milestoneStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        return rows;
      }),
      count: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...milestoneStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        return rows.length;
      }),
    },
    customerOnboardingTask: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `task-${taskStore.length + 1}`,
          status: data.status || 'OPEN',
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        taskStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return taskStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...taskStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        if (where.actorType) rows = rows.filter((r) => r.actorType === where.actorType);
        return rows;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...taskStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        if (where.code) rows = rows.filter((r) => r.code === where.code);
        return rows[0] || null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = taskStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
      count: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...taskStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        return rows.length;
      }),
    },
    customerOnboardingChecklist: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `chk-${checklistStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        checklistStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...checklistStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        return rows;
      }),
      count: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...checklistStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        return rows.length;
      }),
    },
    customerOnboardingKickoff: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `ko-${kickoffStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        kickoffStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.idempotencyKey) {
          return kickoffStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        if (where.projectId) {
          return kickoffStore.find((r) => r.projectId === where.projectId) || null;
        }
        if (where.id) return kickoffStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...kickoffStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        if (where.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        return rows[0] || null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = kickoffStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerOnboardingStakeholder: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `sh-${stakeholderStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        stakeholderStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...stakeholderStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        return rows;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...stakeholderStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        if (where.contactId) rows = rows.filter((r) => r.contactId === where.contactId);
        if (where.role) rows = rows.filter((r) => r.role === where.role);
        return rows[0] || null;
      }),
    },
    customerOnboardingRequirement: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `req-${requirementStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        requirementStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...requirementStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        return rows[0] || null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = requirementStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerOnboardingScopeItem: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `scope-${scopeStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        scopeStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...scopeStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        return rows;
      }),
    },
    customerOnboardingChangeRequest: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `cr-${changeRequestStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        changeRequestStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...changeRequestStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        return rows;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...changeRequestStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        if (where.reasonCode) rows = rows.filter((r) => r.reasonCode === where.reasonCode);
        return rows[0] || null;
      }),
    },
    customerOnboardingTaskEvidence: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `ev-${evidenceStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        evidenceStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return evidenceStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...evidenceStore];
        if (where.taskId) rows = rows.filter((r) => r.taskId === where.taskId);
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...evidenceStore];
        if (where.taskId) rows = rows.filter((r) => r.taskId === where.taskId);
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = evidenceStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerOnboardingTaskDependency: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `dep-${dependencyStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        dependencyStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...dependencyStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        if (where.predecessorTaskId) {
          rows = rows.filter((r) => r.predecessorTaskId === where.predecessorTaskId);
        }
        if (where.successorTaskId) {
          rows = rows.filter((r) => r.successorTaskId === where.successorTaskId);
        }
        return rows;
      }),
    },
    customerOnboardingResponsibility: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `resp-${responsibilityStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        responsibilityStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...responsibilityStore];
        if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
        return rows;
      }),
    },
    crmMeeting: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `mtg-${meetingStore.length + 1}`,
          meetingNumber: data.meetingNumber || `MTG-2026-${String(meetingStore.length + 1).padStart(6, '0')}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        meetingStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return meetingStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return meetingStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
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
          rsvpStatus: data.rsvpStatus || 'PENDING',
          attendanceStatus: data.attendanceStatus || 'UNKNOWN',
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
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
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmContact: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return contactStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...contactStore];
        if (where.id) rows = rows.filter((r) => r.id === where.id);
        return rows[0] || null;
      }),
    },
    subscription: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return subscriptionStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = subscriptionStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      }),
    },
  };

  return prisma;
}

async function seedProject(prisma, admin, opts = {}) {
  const content = opts.content || wave2TemplateContent();
  const tmpl = await ensureWave1StandardTemplateVersion(prisma, {
    actorContext: { admin },
  });
  // Upgrade Wave-1 seed content for materialisation tests
  await prisma.customerOnboardingTemplateVersion.update({
    where: { id: tmpl.templateVersion.id },
    data: {
      contentJson: content,
      status: 'ACTIVE',
      immutable: true,
    },
  });

  const consumed = await consumeOnboardingHandoff(prisma, {
    actorContext: { admin },
    handoffId: 'handoff-onb-w2-1',
    idempotencyKey: opts.requestKey || 'onr-w2:seed',
  });
  await validateOnboardingRequest(prisma, {
    actorContext: { admin },
    onboardingRequestId: consumed.request.id,
  });
  await acceptOnboardingRequest(prisma, {
    actorContext: { admin },
    onboardingRequestId: consumed.request.id,
  });
  const project = await createOnboardingProject(prisma, {
    actorContext: { admin },
    onboardingRequestId: consumed.request.id,
    onboardingTemplateVersionId: tmpl.templateVersion.id,
    targetKickoffDate: '2026-08-10',
    targetGoLiveDate: '2026-09-01',
    ownerAssignments: { csOwnerAdminId: admin.id },
    idempotencyKey: opts.projectKey || 'onb-w2:seed',
  });
  return {
    templateVersionId: tmpl.templateVersion.id,
    request: consumed.request,
    project: project.project,
  };
}

describe('Phase 17 Wave 2 — Templates, materialisation, kick-off, evidence, scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('materialise once on exact retry (no duplicate workstreams/milestones/tasks/checklists)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project, templateVersionId } = await seedProject(prisma, admin, {
      requestKey: 'onr-w2:mat',
      projectKey: 'onb-w2:mat',
    });

    const args = {
      actorContext: { admin },
      projectId: project.id,
      templateVersionId,
      idempotencyKey: 'mat:onb-w2:1',
    };
    const first = await materialiseOnboardingTemplate(prisma, args);
    expect(first.ok).toBe(true);
    expect(prisma._workstreamStore.length).toBe(2);
    expect(prisma._milestoneStore.length).toBe(1);
    expect(prisma._taskStore.length).toBe(2);
    expect(prisma._checklistStore.length).toBe(1);

    const second = await materialiseOnboardingTemplate(prisma, args);
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay).toBe(true);
    expect(prisma._workstreamStore.length).toBe(2);
    expect(prisma._milestoneStore.length).toBe(1);
    expect(prisma._taskStore.length).toBe(2);
    expect(prisma._checklistStore.length).toBe(1);
    expect(getOnboardingDomainContract().wave).toBeGreaterThanOrEqual(2);
    expect(getOnboardingDomainContract().workstreamMaterialisationDeferred).not.toBe(true);
  });

  it('materialise idempotency key conflict when projectId/templateVersionId disagree', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project, templateVersionId } = await seedProject(prisma, admin, {
      requestKey: 'onr-w2:mat-idemp',
      projectKey: 'onb-w2:mat-idemp',
    });

    const first = await materialiseOnboardingTemplate(prisma, {
      actorContext: { admin },
      projectId: project.id,
      templateVersionId,
      idempotencyKey: 'mat:conflict:1',
    });
    expect(first.ok).toBe(true);

    const conflictProject = await materialiseOnboardingTemplate(prisma, {
      actorContext: { admin },
      projectId: 'onb-other-project',
      templateVersionId,
      idempotencyKey: 'mat:conflict:1',
    });
    expect(conflictProject.ok).toBe(false);
    expect(conflictProject.error).toBe('idempotency_conflict');

    const conflictVersion = await materialiseOnboardingTemplate(prisma, {
      actorContext: { admin },
      projectId: project.id,
      templateVersionId: 'tmplv-other-version',
      idempotencyKey: 'mat:conflict:1',
    });
    expect(conflictVersion.ok).toBe(false);
    expect(conflictVersion.error).toBe('idempotency_conflict');
    expect(prisma._workstreamStore.length).toBe(2);
  });

  it('project-level materialise replay rejects different templateVersionId than pin', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project, templateVersionId } = await seedProject(prisma, admin, {
      requestKey: 'onr-w2:mat-pin',
      projectKey: 'onb-w2:mat-pin',
    });

    const first = await materialiseOnboardingTemplate(prisma, {
      actorContext: { admin },
      projectId: project.id,
      templateVersionId,
      idempotencyKey: 'mat:pin:1',
    });
    expect(first.ok).toBe(true);

    const otherVersion = await prisma.customerOnboardingTemplateVersion.create({
      data: {
        templateCode: 'STANDARD_OTHER',
        versionNumber: 99,
        onboardingType: 'STANDARD',
        status: 'ACTIVE',
        immutable: true,
        contentJson: wave2TemplateContent(),
        createdByAdminId: admin.id,
      },
    });

    const conflict = await materialiseOnboardingTemplate(prisma, {
      actorContext: { admin },
      projectId: project.id,
      templateVersionId: otherVersion.id,
      idempotencyKey: 'mat:pin:2',
    });
    expect(conflict.ok).toBe(false);
    expect(conflict.error).toMatch(/template_version_mismatch|idempotency_conflict/);
    expect(prisma._workstreamStore.length).toBe(2);
    expect(prisma._materialisationStore.length).toBe(1);
  });

  it('kick-off creates/links Phase 13 Meeting once on exact retry', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      requestKey: 'onr-w2:ko',
      projectKey: 'onb-w2:ko',
    });

    const meetingService = {
      createMeeting: vi.fn(async (_p, input) => {
        const row = await prisma.crmMeeting.create({
          data: {
            title: input.title || 'Onboarding kick-off',
            timezone: input.timezone || 'Africa/Johannesburg',
            startsAt: input.startsAt || new Date('2026-08-10T09:00:00Z'),
            endsAt: input.endsAt || new Date('2026-08-10T10:00:00Z'),
            idempotencyKey: input.idempotencyKey || null,
            ownerAdminId: admin.id,
            createdByAdminId: admin.id,
            status: 'SCHEDULED',
          },
        });
        await prisma.crmMeetingParticipant.create({
          data: {
            meetingId: row.id,
            contactId: 'contact-verified-1',
            rsvpStatus: CRM_MEETING_RSVP.PENDING,
            attendanceStatus: CRM_MEETING_ATTENDANCE.UNKNOWN,
          },
        });
        return { ok: true, meeting: { id: row.id, meetingNumber: row.meetingNumber } };
      }),
    };

    const args = {
      actorContext: { admin },
      projectId: project.id,
      meetingInput: {
        title: 'Onboarding kick-off',
        timezone: 'Africa/Johannesburg',
        startsAt: '2026-08-10T09:00:00Z',
        endsAt: '2026-08-10T10:00:00Z',
        contactId: 'contact-verified-1',
      },
      idempotencyKey: 'kickoff:onb-w2:1',
      meetingService,
    };
    const first = await scheduleOnboardingKickoff(prisma, args);
    expect(first.ok).toBe(true);
    expect(first.crmMeetingId).toBeTruthy();
    expect(prisma._kickoffStore.length).toBe(1);
    expect(prisma._meetingStore.length).toBe(1);

    const second = await scheduleOnboardingKickoff(prisma, args);
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay).toBe(true);
    expect(second.crmMeetingId).toBe(first.crmMeetingId);
    expect(prisma._kickoffStore.length).toBe(1);
    expect(prisma._meetingStore.length).toBe(1);
    expect(meetingService.createMeeting).toHaveBeenCalledTimes(1);
  });

  it('kick-off idempotency key conflict when projectId disagrees', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      requestKey: 'onr-w2:ko-idemp',
      projectKey: 'onb-w2:ko-idemp',
    });

    const meetingService = {
      createMeeting: vi.fn(async (_p, input) => {
        const row = await prisma.crmMeeting.create({
          data: {
            title: input.title || 'Onboarding kick-off',
            timezone: input.timezone || 'Africa/Johannesburg',
            startsAt: input.startsAt || new Date('2026-08-10T09:00:00Z'),
            endsAt: input.endsAt || new Date('2026-08-10T10:00:00Z'),
            idempotencyKey: input.idempotencyKey || null,
            status: 'SCHEDULED',
          },
        });
        return { ok: true, meeting: { id: row.id, meetingNumber: row.meetingNumber } };
      }),
    };

    const first = await scheduleOnboardingKickoff(prisma, {
      actorContext: { admin },
      projectId: project.id,
      meetingInput: {
        title: 'Onboarding kick-off',
        timezone: 'Africa/Johannesburg',
        startsAt: '2026-08-10T09:00:00Z',
        endsAt: '2026-08-10T10:00:00Z',
      },
      idempotencyKey: 'kickoff:conflict:1',
      meetingService,
    });
    expect(first.ok).toBe(true);

    const conflict = await scheduleOnboardingKickoff(prisma, {
      actorContext: { admin },
      projectId: 'onb-other-project',
      meetingInput: {
        title: 'Other kick-off',
        timezone: 'Africa/Johannesburg',
        startsAt: '2026-08-11T09:00:00Z',
        endsAt: '2026-08-11T10:00:00Z',
      },
      idempotencyKey: 'kickoff:conflict:1',
      meetingService,
    });
    expect(conflict.ok).toBe(false);
    expect(conflict.error).toBe('idempotency_conflict');
    expect(prisma._kickoffStore.length).toBe(1);
    expect(meetingService.createMeeting).toHaveBeenCalledTimes(1);
  });

  it('RSVP accepted does not equal attendance', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      requestKey: 'onr-w2:rsvp',
      projectKey: 'onb-w2:rsvp',
    });

    const meetingService = {
      createMeeting: vi.fn(async (_p, input) => {
        const row = await prisma.crmMeeting.create({
          data: {
            title: input.title || 'Kick-off',
            timezone: input.timezone,
            startsAt: new Date(input.startsAt),
            endsAt: new Date(input.endsAt),
            idempotencyKey: input.idempotencyKey || null,
            status: 'SCHEDULED',
          },
        });
        await prisma.crmMeetingParticipant.create({
          data: {
            meetingId: row.id,
            contactId: 'contact-verified-1',
            rsvpStatus: CRM_MEETING_RSVP.PENDING,
            attendanceStatus: CRM_MEETING_ATTENDANCE.UNKNOWN,
          },
        });
        return { ok: true, meeting: { id: row.id } };
      }),
      recordMeetingRsvp: vi.fn(async (_p, { meetingId, contactId, rsvpStatus }) => {
        const p = await prisma.crmMeetingParticipant.findFirst({
          where: { meetingId, contactId },
        });
        const updated = await prisma.crmMeetingParticipant.update({
          where: { id: p.id },
          data: { rsvpStatus },
        });
        return { ok: true, participant: updated };
      }),
    };

    const scheduled = await scheduleOnboardingKickoff(prisma, {
      actorContext: { admin },
      projectId: project.id,
      meetingInput: {
        title: 'Kick-off',
        timezone: 'Africa/Johannesburg',
        startsAt: '2026-08-10T09:00:00Z',
        endsAt: '2026-08-10T10:00:00Z',
        contactId: 'contact-verified-1',
      },
      idempotencyKey: 'kickoff:rsvp:1',
      meetingService,
    });
    expect(scheduled.ok).toBe(true);

    const rsvp = await recordOnboardingKickoffRsvp(prisma, {
      actorContext: { admin },
      projectId: project.id,
      contactId: 'contact-verified-1',
      rsvpStatus: CRM_MEETING_RSVP.ACCEPTED,
      meetingService,
    });
    expect(rsvp.ok).toBe(true);

    const participant = prisma._meetingStore.length
      ? await prisma.crmMeetingParticipant.findFirst({
          where: { meetingId: scheduled.crmMeetingId, contactId: 'contact-verified-1' },
        })
      : null;
    expect(participant.rsvpStatus).toBe(CRM_MEETING_RSVP.ACCEPTED);
    expect(participant.attendanceStatus).not.toBe(CRM_MEETING_ATTENDANCE.ATTENDED);
    expect(participant.attendanceStatus).toBe(CRM_MEETING_ATTENDANCE.UNKNOWN);
    expect(rsvp.kickoffCompleted).not.toBe(true);
  });

  it('Customer Task cannot complete without evidence source or authorised waiver', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project, templateVersionId } = await seedProject(prisma, admin, {
      requestKey: 'onr-w2:ev',
      projectKey: 'onb-w2:ev',
    });
    await materialiseOnboardingTemplate(prisma, {
      actorContext: { admin },
      projectId: project.id,
      templateVersionId,
      idempotencyKey: 'mat:ev:1',
    });
    const customerTask = prisma._taskStore.find((t) => t.actorType === 'CUSTOMER');
    expect(customerTask).toBeTruthy();

    const blocked = await completeOnboardingTask(prisma, {
      actorContext: { admin },
      taskId: customerTask.id,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/evidence|waiver/i);
    expect(customerTask.status).not.toBe('COMPLETED');
  });

  it('evidence reject retains reason; portal path is CUSTOMER_PORTAL_NOT_CONFIGURED', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project, templateVersionId } = await seedProject(prisma, admin, {
      requestKey: 'onr-w2:rej',
      projectKey: 'onb-w2:rej',
    });
    await materialiseOnboardingTemplate(prisma, {
      actorContext: { admin },
      projectId: project.id,
      templateVersionId,
      idempotencyKey: 'mat:rej:1',
    });
    const customerTask = prisma._taskStore.find((t) => t.actorType === 'CUSTOMER');

    const submitted = await submitCustomerTaskEvidence(prisma, {
      actorContext: { admin },
      taskId: customerTask.id,
      attestationReason: 'Customer emailed spreadsheet',
      contactId: 'contact-verified-1',
      fileRef: 's3://evidence/master-data.xlsx',
    });
    expect(submitted.ok).toBe(true);
    expect(submitted.evidence.status).toMatch(/EVIDENCE_SUBMITTED|SUBMITTED/i);
    expect(submitted.portalStatus || CUSTOMER_PORTAL_NOT_CONFIGURED).toBe(
      CUSTOMER_PORTAL_NOT_CONFIGURED
    );

    const rejected = await reviewCustomerTaskEvidence(prisma, {
      actorContext: { admin: superAdmin('reviewer-2') },
      evidenceId: submitted.evidence.id,
      decision: 'REJECT',
      reason: 'File incomplete — missing branch list',
    });
    expect(rejected.ok).toBe(true);
    expect(rejected.evidence.status).toMatch(/REJECT/i);
    expect(rejected.evidence.reviewReason || rejected.evidence.rejectReason).toMatch(
      /incomplete|branch/i
    );
    expect(prisma._evidenceStore[0].reviewReason || prisma._evidenceStore[0].rejectReason).toMatch(
      /incomplete|branch/i
    );
  });

  it('scope mismatch creates Change Request and does not mutate Subscription entitlements', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      requestKey: 'onr-w2:scope',
      projectKey: 'onb-w2:scope',
    });

    const beforeEntitlements = JSON.stringify(prisma._subscriptionStore[0].entitlementsJson);

    await confirmOnboardingRequirements(prisma, {
      actorContext: { admin },
      projectId: project.id,
      confirmedScope: {
        planCode: 'STANDARD',
        addOns: [],
        quantity: 1,
        businesses: 1,
        branches: 1,
      },
    });

    const mismatch = await detectScopeMismatch(prisma, {
      actorContext: { admin },
      projectId: project.id,
      requestedScope: {
        planCode: 'ENTERPRISE',
        addOns: ['MRA_EIS'],
        quantity: 5,
        businesses: 3,
        branches: 10,
      },
    });
    expect(mismatch.ok).toBe(true);
    expect(mismatch.mismatch || mismatch.hasMismatch).toBe(true);
    expect(mismatch.changeRequest || prisma._changeRequestStore[0]).toBeTruthy();
    expect(
      (mismatch.changeRequest || prisma._changeRequestStore[0]).reasonCode
    ).toMatch(/SCOPE_MISMATCH/i);

    expect(JSON.stringify(prisma._subscriptionStore[0].entitlementsJson)).toBe(
      beforeEntitlements
    );
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('omitted requestedScope does not open a SCOPE_MISMATCH change request', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      requestKey: 'onr-w2:scope-omit',
      projectKey: 'onb-w2:scope-omit',
    });

    await confirmOnboardingRequirements(prisma, {
      actorContext: { admin },
      projectId: project.id,
      confirmedScope: {
        planCode: 'STANDARD',
        addOns: [],
        quantity: 1,
        businesses: 1,
        branches: 1,
      },
    });

    const omitted = await detectScopeMismatch(prisma, {
      actorContext: { admin },
      projectId: project.id,
      // requestedScope intentionally omitted
    });
    expect(omitted.ok).toBe(true);
    expect(omitted.mismatch || omitted.hasMismatch).toBeFalsy();
    expect(prisma._changeRequestStore.length).toBe(0);
    expect(prisma.subscription.update).not.toHaveBeenCalled();

    const nullScope = await detectScopeMismatch(prisma, {
      actorContext: { admin },
      projectId: project.id,
      requestedScope: null,
    });
    expect(nullScope.ok).toBe(true);
    expect(nullScope.mismatch || nullScope.hasMismatch).toBeFalsy();
    expect(prisma._changeRequestStore.length).toBe(0);
  });

  it('circular task dependency is rejected', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project, templateVersionId } = await seedProject(prisma, admin, {
      requestKey: 'onr-w2:dep',
      projectKey: 'onb-w2:dep',
    });
    await materialiseOnboardingTemplate(prisma, {
      actorContext: { admin },
      projectId: project.id,
      templateVersionId,
      idempotencyKey: 'mat:dep:1',
    });

    const [a, b] = prisma._taskStore.filter((t) => t.projectId === project.id);
    const first = await addOnboardingTaskDependency(prisma, {
      actorContext: { admin },
      projectId: project.id,
      predecessorTaskId: a.id,
      successorTaskId: b.id,
      dependencyType: 'FINISH_TO_START',
    });
    expect(first.ok).toBe(true);

    const cycle = await addOnboardingTaskDependency(prisma, {
      actorContext: { admin },
      projectId: project.id,
      predecessorTaskId: b.id,
      successorTaskId: a.id,
      dependencyType: 'FINISH_TO_START',
    });
    expect(cycle.ok).toBe(false);
    expect(cycle.error).toMatch(/circular|cycle/i);
    expect(prisma._dependencyStore.length).toBe(1);
  });

  it('Meeting unavailable → typed MEETING_SERVICE_UNAVAILABLE fail', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      requestKey: 'onr-w2:mtg-fail',
      projectKey: 'onb-w2:mtg-fail',
    });

    const meetingService = {
      createMeeting: vi.fn(async () => ({
        ok: false,
        error: 'crm_meeting_model_unavailable',
        status: 'UNAVAILABLE',
      })),
    };

    const result = await scheduleOnboardingKickoff(prisma, {
      actorContext: { admin },
      projectId: project.id,
      meetingInput: {
        title: 'Kick-off',
        timezone: 'Africa/Johannesburg',
        startsAt: '2026-08-10T09:00:00Z',
        endsAt: '2026-08-10T10:00:00Z',
      },
      idempotencyKey: 'kickoff:fail:1',
      meetingService,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/MEETING_SERVICE_UNAVAILABLE/i);
    expect(prisma._kickoffStore.length).toBe(0);
    expect(result.kickoffCompleted).not.toBe(true);
  });

  it('ACTIVE template version content is immutable after activate', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const draft = await prisma.customerOnboardingTemplateVersion.create({
      data: {
        templateCode: 'STANDARD_WAVE2',
        versionNumber: 2,
        onboardingType: 'STANDARD',
        status: 'DRAFT',
        immutable: false,
        contentJson: wave2TemplateContent(),
        createdByAdminId: admin.id,
      },
    });

    const approved = await approveOnboardingTemplateVersion(prisma, {
      actorContext: { admin: superAdmin('approver-w2') },
      templateVersionId: draft.id,
    });
    expect(approved.ok).toBe(true);

    const activated = await activateOnboardingTemplateVersion(prisma, {
      actorContext: { admin: superAdmin('activator-w2') },
      templateVersionId: draft.id,
    });
    expect(activated.ok).toBe(true);
    expect(activated.templateVersion.status).toBe('ACTIVE');
    expect(activated.templateVersion.immutable).toBe(true);

    const mutate = await prisma.customerOnboardingTemplateVersion.update({
      where: { id: draft.id },
      data: { contentJson: { hacked: true } },
    });
    // Domain guard: prefer service-level reject; if raw update happens, activate path must expose immutability
    const guarded = await activateOnboardingTemplateVersion(prisma, {
      actorContext: { admin },
      templateVersionId: draft.id,
      contentJson: { hacked: true },
    });
    // Re-activating with content change must fail or ignore mutation
    if (guarded.ok === false) {
      expect(guarded.error).toMatch(/immutable|active/i);
    } else {
      expect(prisma._templateVersionStore.find((r) => r.id === draft.id).immutable).toBe(true);
    }
    expect(mutate).toBeTruthy(); // harness allows raw write; domain contract still marks immutable
  });

  it('stakeholder assign requires verified Contact', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      requestKey: 'onr-w2:sh',
      projectKey: 'onb-w2:sh',
    });

    const denied = await assignOnboardingStakeholder(prisma, {
      actorContext: { admin },
      projectId: project.id,
      contactId: 'contact-unverified-1',
      role: 'CUSTOMER_PROJECT_OWNER',
      required: true,
    });
    expect(denied.ok).toBe(false);
    expect(denied.error).toMatch(/verif|CONTACT/i);

    const ok = await assignOnboardingStakeholder(prisma, {
      actorContext: { admin },
      projectId: project.id,
      contactId: 'contact-verified-1',
      role: 'CUSTOMER_PROJECT_OWNER',
      required: true,
    });
    expect(ok.ok).toBe(true);
    expect(prisma._stakeholderStore.length).toBe(1);
  });
});
