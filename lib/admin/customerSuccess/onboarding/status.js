/**
 * Onboarding Request / Project status transitions — Phase 17 Wave 1.
 * Invalid transitions throw.
 */

import {
  ONBOARDING_REQUEST_STATUS,
  ONBOARDING_PROJECT_STATUS,
  getOnboardingDomainContract,
} from './catalogue.js';
import {
  hasCustomerOnboardingRequestStatusHistoryModel,
  hasCustomerOnboardingProjectStatusHistoryModel,
  resolveOnboardingActor,
  serializeOnboardingRequest,
  serializeOnboardingProject,
} from './model.js';

const REQUEST_TRANSITIONS = Object.freeze({
  [ONBOARDING_REQUEST_STATUS.NEW]: [
    ONBOARDING_REQUEST_STATUS.VALIDATING,
    ONBOARDING_REQUEST_STATUS.INFORMATION_REQUIRED,
    ONBOARDING_REQUEST_STATUS.READY,
    ONBOARDING_REQUEST_STATUS.REJECTED,
    ONBOARDING_REQUEST_STATUS.CANCELLED,
    ONBOARDING_REQUEST_STATUS.CUSTOMER_DEFERRED,
  ],
  [ONBOARDING_REQUEST_STATUS.VALIDATING]: [
    ONBOARDING_REQUEST_STATUS.INFORMATION_REQUIRED,
    ONBOARDING_REQUEST_STATUS.DUPLICATE_REVIEW_REQUIRED,
    ONBOARDING_REQUEST_STATUS.READY,
    ONBOARDING_REQUEST_STATUS.REJECTED,
    ONBOARDING_REQUEST_STATUS.CANCELLED,
  ],
  [ONBOARDING_REQUEST_STATUS.INFORMATION_REQUIRED]: [
    ONBOARDING_REQUEST_STATUS.VALIDATING,
    ONBOARDING_REQUEST_STATUS.READY,
    ONBOARDING_REQUEST_STATUS.REJECTED,
    ONBOARDING_REQUEST_STATUS.CANCELLED,
    ONBOARDING_REQUEST_STATUS.CUSTOMER_DEFERRED,
  ],
  [ONBOARDING_REQUEST_STATUS.DUPLICATE_REVIEW_REQUIRED]: [
    ONBOARDING_REQUEST_STATUS.VALIDATING,
    ONBOARDING_REQUEST_STATUS.READY,
    ONBOARDING_REQUEST_STATUS.REJECTED,
    ONBOARDING_REQUEST_STATUS.CANCELLED,
    ONBOARDING_REQUEST_STATUS.SUPERSEDED,
  ],
  [ONBOARDING_REQUEST_STATUS.READY]: [
    ONBOARDING_REQUEST_STATUS.ACCEPTED,
    ONBOARDING_REQUEST_STATUS.REJECTED,
    ONBOARDING_REQUEST_STATUS.CANCELLED,
    ONBOARDING_REQUEST_STATUS.CUSTOMER_DEFERRED,
    ONBOARDING_REQUEST_STATUS.INFORMATION_REQUIRED,
  ],
  [ONBOARDING_REQUEST_STATUS.ACCEPTED]: [
    ONBOARDING_REQUEST_STATUS.CONVERTED_TO_PROJECT,
    ONBOARDING_REQUEST_STATUS.REJECTED,
    ONBOARDING_REQUEST_STATUS.CANCELLED,
    ONBOARDING_REQUEST_STATUS.CUSTOMER_DEFERRED,
  ],
  [ONBOARDING_REQUEST_STATUS.CONVERTED_TO_PROJECT]: [ONBOARDING_REQUEST_STATUS.ARCHIVED],
  [ONBOARDING_REQUEST_STATUS.REJECTED]: [ONBOARDING_REQUEST_STATUS.ARCHIVED],
  [ONBOARDING_REQUEST_STATUS.CANCELLED]: [ONBOARDING_REQUEST_STATUS.ARCHIVED],
  [ONBOARDING_REQUEST_STATUS.CUSTOMER_DEFERRED]: [
    ONBOARDING_REQUEST_STATUS.READY,
    ONBOARDING_REQUEST_STATUS.CANCELLED,
    ONBOARDING_REQUEST_STATUS.ARCHIVED,
  ],
  [ONBOARDING_REQUEST_STATUS.SUPERSEDED]: [ONBOARDING_REQUEST_STATUS.ARCHIVED],
  [ONBOARDING_REQUEST_STATUS.ARCHIVED]: [],
});

/** Wave 1 subset — no skip from IN_PROGRESS to COMPLETED. */
const PROJECT_TRANSITIONS = Object.freeze({
  [ONBOARDING_PROJECT_STATUS.DRAFT]: [
    ONBOARDING_PROJECT_STATUS.REQUEST_VALIDATION,
    ONBOARDING_PROJECT_STATUS.READY_FOR_KICKOFF,
    ONBOARDING_PROJECT_STATUS.CANCELLED,
  ],
  [ONBOARDING_PROJECT_STATUS.REQUEST_VALIDATION]: [
    ONBOARDING_PROJECT_STATUS.READY_FOR_KICKOFF,
    ONBOARDING_PROJECT_STATUS.BLOCKED,
    ONBOARDING_PROJECT_STATUS.CANCELLED,
  ],
  [ONBOARDING_PROJECT_STATUS.READY_FOR_KICKOFF]: [
    ONBOARDING_PROJECT_STATUS.KICKOFF_SCHEDULING,
    ONBOARDING_PROJECT_STATUS.PAUSED,
    ONBOARDING_PROJECT_STATUS.CANCELLED,
  ],
  [ONBOARDING_PROJECT_STATUS.KICKOFF_SCHEDULING]: [
    ONBOARDING_PROJECT_STATUS.KICKOFF_COMPLETED,
    ONBOARDING_PROJECT_STATUS.BLOCKED,
    ONBOARDING_PROJECT_STATUS.CANCELLED,
  ],
  [ONBOARDING_PROJECT_STATUS.KICKOFF_COMPLETED]: [
    ONBOARDING_PROJECT_STATUS.PLANNING,
    ONBOARDING_PROJECT_STATUS.IN_PROGRESS,
  ],
  [ONBOARDING_PROJECT_STATUS.PLANNING]: [
    ONBOARDING_PROJECT_STATUS.IN_PROGRESS,
    ONBOARDING_PROJECT_STATUS.BLOCKED,
    ONBOARDING_PROJECT_STATUS.PAUSED,
  ],
  [ONBOARDING_PROJECT_STATUS.IN_PROGRESS]: [
    ONBOARDING_PROJECT_STATUS.GO_LIVE_READINESS,
    ONBOARDING_PROJECT_STATUS.BLOCKED,
    ONBOARDING_PROJECT_STATUS.PAUSED,
    ONBOARDING_PROJECT_STATUS.FAILED,
  ],
  [ONBOARDING_PROJECT_STATUS.GO_LIVE_READINESS]: [
    ONBOARDING_PROJECT_STATUS.READY_FOR_GO_LIVE,
    ONBOARDING_PROJECT_STATUS.BLOCKED,
    ONBOARDING_PROJECT_STATUS.IN_PROGRESS,
  ],
  [ONBOARDING_PROJECT_STATUS.READY_FOR_GO_LIVE]: [
    ONBOARDING_PROJECT_STATUS.GO_LIVE_SCHEDULED,
    ONBOARDING_PROJECT_STATUS.BLOCKED,
  ],
  [ONBOARDING_PROJECT_STATUS.GO_LIVE_SCHEDULED]: [
    ONBOARDING_PROJECT_STATUS.GO_LIVE_IN_PROGRESS,
    ONBOARDING_PROJECT_STATUS.CANCELLED,
  ],
  [ONBOARDING_PROJECT_STATUS.GO_LIVE_IN_PROGRESS]: [
    ONBOARDING_PROJECT_STATUS.LIVE,
    ONBOARDING_PROJECT_STATUS.FAILED,
  ],
  [ONBOARDING_PROJECT_STATUS.LIVE]: [ONBOARDING_PROJECT_STATUS.STABILISATION],
  [ONBOARDING_PROJECT_STATUS.STABILISATION]: [
    ONBOARDING_PROJECT_STATUS.HANDOVER_PENDING,
    ONBOARDING_PROJECT_STATUS.BLOCKED,
  ],
  [ONBOARDING_PROJECT_STATUS.HANDOVER_PENDING]: [
    ONBOARDING_PROJECT_STATUS.COMPLETION_PENDING,
  ],
  [ONBOARDING_PROJECT_STATUS.COMPLETION_PENDING]: [
    ONBOARDING_PROJECT_STATUS.COMPLETED,
    ONBOARDING_PROJECT_STATUS.COMPLETED_WITH_OPEN_ITEMS,
    ONBOARDING_PROJECT_STATUS.COMPLETED_WITH_GAPS,
  ],
  [ONBOARDING_PROJECT_STATUS.COMPLETED]: [ONBOARDING_PROJECT_STATUS.ARCHIVED],
  [ONBOARDING_PROJECT_STATUS.COMPLETED_WITH_OPEN_ITEMS]: [
    ONBOARDING_PROJECT_STATUS.ARCHIVED,
  ],
  [ONBOARDING_PROJECT_STATUS.COMPLETED_WITH_GAPS]: [
    ONBOARDING_PROJECT_STATUS.ARCHIVED,
  ],
  [ONBOARDING_PROJECT_STATUS.PAUSED]: [
    ONBOARDING_PROJECT_STATUS.IN_PROGRESS,
    ONBOARDING_PROJECT_STATUS.READY_FOR_KICKOFF,
    ONBOARDING_PROJECT_STATUS.CANCELLED,
  ],
  [ONBOARDING_PROJECT_STATUS.BLOCKED]: [
    ONBOARDING_PROJECT_STATUS.IN_PROGRESS,
    ONBOARDING_PROJECT_STATUS.GO_LIVE_READINESS,
    ONBOARDING_PROJECT_STATUS.CANCELLED,
    ONBOARDING_PROJECT_STATUS.FAILED,
  ],
  [ONBOARDING_PROJECT_STATUS.CUSTOMER_DEFERRED]: [
    ONBOARDING_PROJECT_STATUS.READY_FOR_KICKOFF,
    ONBOARDING_PROJECT_STATUS.CANCELLED,
  ],
  [ONBOARDING_PROJECT_STATUS.CANCELLED]: [ONBOARDING_PROJECT_STATUS.ARCHIVED],
  [ONBOARDING_PROJECT_STATUS.FAILED]: [
    ONBOARDING_PROJECT_STATUS.IN_PROGRESS,
    ONBOARDING_PROJECT_STATUS.ARCHIVED,
  ],
  [ONBOARDING_PROJECT_STATUS.ARCHIVED]: [],
});

export function canTransitionOnboardingRequestStatus(from, to) {
  const allowed = REQUEST_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function canTransitionOnboardingProjectStatus(from, to) {
  const allowed = PROJECT_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function assertCanTransitionOnboardingRequestStatus(from, to) {
  if (from === to) return;
  if (!canTransitionOnboardingRequestStatus(from, to)) {
    throw new Error(`invalid_status_transition: ${from} → ${to}`);
  }
}

export function assertCanTransitionOnboardingProjectStatus(from, to) {
  if (from === to) return;
  if (!canTransitionOnboardingProjectStatus(from, to)) {
    throw new Error(`invalid_status_transition: ${from} → ${to}`);
  }
}

/**
 * Transition Request status. Invalid transition throws.
 */
export async function transitionOnboardingRequestStatus(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  const row = await prisma.customerOnboardingRequest.findUnique({
    where: { id: args.onboardingRequestId || args.requestId },
  });
  if (!row) {
    return { ok: false, notFound: true, error: 'onboarding_request_not_found' };
  }

  const toStatus = String(args.toStatus || '')
    .trim()
    .toUpperCase();
  if (row.status === toStatus) {
    return {
      ok: true,
      request: serializeOnboardingRequest(row),
      alreadyInStatus: true,
      domain: getOnboardingDomainContract(),
    };
  }

  assertCanTransitionOnboardingRequestStatus(row.status, toStatus);

  const now = args.now || new Date();
  const updated = await prisma.customerOnboardingRequest.update({
    where: { id: row.id },
    data: {
      status: toStatus,
      updatedAt: now,
      ...(args.projectId ? { projectId: args.projectId } : {}),
    },
  });

  if (hasCustomerOnboardingRequestStatusHistoryModel(prisma)) {
    await prisma.customerOnboardingRequestStatusHistory.create({
      data: {
        requestId: row.id,
        fromStatus: row.status,
        toStatus,
        reason: args.reason != null ? String(args.reason).trim().slice(0, 1000) : null,
        changedByAdminId: admin?.id || null,
        at: now,
      },
    });
  }

  return {
    ok: true,
    request: serializeOnboardingRequest(updated),
    domain: getOnboardingDomainContract(),
  };
}

/**
 * Transition Project status. Invalid transition throws.
 */
export async function transitionOnboardingProjectStatus(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  const row = await prisma.customerOnboardingProject.findUnique({
    where: { id: args.onboardingProjectId || args.projectId },
  });
  if (!row) {
    return { ok: false, notFound: true, error: 'onboarding_project_not_found' };
  }

  const toStatus = String(args.toStatus || '')
    .trim()
    .toUpperCase();
  if (row.status === toStatus) {
    return {
      ok: true,
      project: serializeOnboardingProject(row),
      alreadyInStatus: true,
      domain: getOnboardingDomainContract(),
    };
  }

  assertCanTransitionOnboardingProjectStatus(row.status, toStatus);

  const now = args.now || new Date();
  const updated = await prisma.customerOnboardingProject.update({
    where: { id: row.id },
    data: { status: toStatus, updatedAt: now },
  });

  if (hasCustomerOnboardingProjectStatusHistoryModel(prisma)) {
    await prisma.customerOnboardingProjectStatusHistory.create({
      data: {
        projectId: row.id,
        fromStatus: row.status,
        toStatus,
        reason: args.reason != null ? String(args.reason).trim().slice(0, 1000) : null,
        changedByAdminId: admin?.id || null,
        at: now,
      },
    });
  }

  return {
    ok: true,
    project: serializeOnboardingProject(updated),
    domain: getOnboardingDomainContract(),
  };
}

export { ONBOARDING_REQUEST_STATUS, ONBOARDING_PROJECT_STATUS };
