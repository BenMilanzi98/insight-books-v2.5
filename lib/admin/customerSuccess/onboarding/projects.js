/**
 * Customer Onboarding Projects (ONB-YYYY-######) — Phase 17 Wave 1.
 * Requires pinned ACTIVE templateVersionId. No workstream materialisation.
 */

import { createHash } from 'crypto';
import {
  ONBOARDING_PROJECT_STATUS,
  ONBOARDING_REQUEST_STATUS,
  ONBOARDING_TYPE,
  getOnboardingDomainContract,
} from './catalogue.js';
import { allocateOnboardingProjectNumber } from './numbering.js';
import {
  canManageOnboarding,
  canViewOnboarding,
  hasCustomerOnboardingProjectModel,
  hasCustomerOnboardingTemplateVersionModel,
  resolveOnboardingActor,
  serializeOnboardingProject,
} from './model.js';
import { requestMissingPins } from './requests.js';
import { transitionOnboardingRequestStatus } from './status.js';
import {
  resolveOnboardingListScope,
  tenantWhereFromScope,
} from './listScope.js';
import { assertOnboardingTenantInPortfolioScope } from './projectAccess.js';

const ACTIVE_PROJECT_EXCLUSIONS = Object.freeze([
  ONBOARDING_PROJECT_STATUS.CANCELLED,
  ONBOARDING_PROJECT_STATUS.ARCHIVED,
  ONBOARDING_PROJECT_STATUS.COMPLETED,
  ONBOARDING_PROJECT_STATUS.COMPLETED_WITH_OPEN_ITEMS,
  ONBOARDING_PROJECT_STATUS.FAILED,
]);

function hashProjectInput(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Persist My Work owner pins from ownerAssignments (and actor fallback).
 * Columns csOwnerAdminId / ownerAdminId are queried by getOnboardingMyWork —
 * ownerAssignmentsJson alone is not enough for the Prisma OR filter.
 */
function resolveOwnerPins(ownerAssignments = {}, admin = null) {
  const assignments =
    ownerAssignments && typeof ownerAssignments === 'object' ? ownerAssignments : {};
  const csOwnerAdminId =
    (assignments.csOwnerAdminId && String(assignments.csOwnerAdminId)) ||
    (assignments.csOwnerId && String(assignments.csOwnerId)) ||
    (admin?.id ? String(admin.id) : null);
  const ownerAdminId =
    (assignments.ownerAdminId && String(assignments.ownerAdminId)) ||
    (assignments.implementationOwnerAdminId &&
      String(assignments.implementationOwnerAdminId)) ||
    (assignments.implementationOwnerId && String(assignments.implementationOwnerId)) ||
    csOwnerAdminId ||
    (admin?.id ? String(admin.id) : null);
  return { csOwnerAdminId, ownerAdminId };
}

/**
 * Repair Request → CONVERTED_TO_PROJECT when Project already exists.
 * Safe no-op if already converted. Never fabricates onboarding COMPLETED.
 */
async function ensureRequestConvertedToProject(prisma, args = {}) {
  const { admin, request, project, now, actorContext } = args;
  if (!request || !project) return;
  if (request.status === ONBOARDING_REQUEST_STATUS.CONVERTED_TO_PROJECT) {
    if (!request.projectId && project.id) {
      await prisma.customerOnboardingRequest.update({
        where: { id: request.id },
        data: { projectId: project.id, updatedAt: now || new Date() },
      });
    }
    return;
  }
  if (request.status !== ONBOARDING_REQUEST_STATUS.ACCEPTED) return;

  await transitionOnboardingRequestStatus(prisma, {
    admin,
    actorContext,
    onboardingRequestId: request.id,
    toStatus: ONBOARDING_REQUEST_STATUS.CONVERTED_TO_PROJECT,
    projectId: project.id,
    reason: 'converted_to_project',
    now: now || new Date(),
  });
}

/**
 * Create Onboarding Project from accepted Request. One Request → at most one Project.
 */
export async function createOnboardingProject(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'onboarding_project_create_forbidden',
    };
  }
  if (!hasCustomerOnboardingProjectModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_project_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const onboardingRequestId = args.onboardingRequestId
    ? String(args.onboardingRequestId).trim()
    : '';
  if (!onboardingRequestId) {
    return { ok: false, error: 'onboarding_request_id_required' };
  }

  const templateVersionId = args.onboardingTemplateVersionId || args.templateVersionId;
  if (!templateVersionId) {
    return { ok: false, error: 'template_version_id_required' };
  }

  if (hasCustomerOnboardingTemplateVersionModel(prisma)) {
    const tmpl = await prisma.customerOnboardingTemplateVersion.findUnique({
      where: { id: String(templateVersionId) },
    });
    if (!tmpl) {
      return { ok: false, error: 'template_version_not_found' };
    }
    if (String(tmpl.status).toUpperCase() !== 'ACTIVE') {
      return { ok: false, error: 'template_version_not_active' };
    }
  }

  const request = await prisma.customerOnboardingRequest.findUnique({
    where: { id: onboardingRequestId },
  });
  if (!request) {
    return { ok: false, notFound: true, error: 'onboarding_request_not_found' };
  }

  // Portfolio fail-closed on create-by-id (Phase 21 Wave 1)
  const scopeGate = await assertOnboardingTenantInPortfolioScope(
    prisma,
    admin,
    request.tenantId,
    args
  );
  if (!scopeGate.ok) return scopeGate;

  const missing = requestMissingPins(request);
  if (missing.length) {
    return {
      ok: false,
      error: `missing_required_pins: ${missing.join(',')}`,
      missing,
    };
  }

  const now = args.now || new Date();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  if (!idempotencyKey) {
    return { ok: false, error: 'idempotency_key_required' };
  }

  const ownerAssignments = args.ownerAssignments || {};
  const { csOwnerAdminId, ownerAdminId } = resolveOwnerPins(ownerAssignments, admin);
  const inputPayload = {
    onboardingRequestId,
    onboardingTemplateVersionId: String(templateVersionId),
    targetKickoffDate: args.targetKickoffDate || null,
    targetGoLiveDate: args.targetGoLiveDate || null,
    ownerAssignments,
  };
  const inputHash = hashProjectInput(inputPayload);

  // Exact / conflicting retry by idempotency key
  const existingByKey = await prisma.customerOnboardingProject.findUnique({
    where: { idempotencyKey },
  });
  if (existingByKey) {
    if (existingByKey.inputHash && existingByKey.inputHash !== inputHash) {
      return {
        ok: false,
        error: 'idempotency_conflict',
        existingInputHash: existingByKey.inputHash,
        attemptedInputHash: inputHash,
      };
    }
    await ensureRequestConvertedToProject(prisma, {
      admin,
      actorContext: args.actorContext,
      request,
      project: existingByKey,
      now,
    });
    return {
      ok: true,
      project: serializeOnboardingProject(existingByKey),
      alreadyExists: true,
      idempotentReplay: true,
      onboardingCompleted: false,
      workstreamsMaterialised: false,
      domain: getOnboardingDomainContract(),
    };
  }

  // One Request → at most one Project
  const existingByRequest = await prisma.customerOnboardingProject.findFirst({
    where: { onboardingRequestId },
  });
  if (existingByRequest) {
    await ensureRequestConvertedToProject(prisma, {
      admin,
      actorContext: args.actorContext,
      request,
      project: existingByRequest,
      now,
    });
    return {
      ok: true,
      project: serializeOnboardingProject(existingByRequest),
      alreadyExists: true,
      idempotentReplay: true,
      onboardingCompleted: false,
      workstreamsMaterialised: false,
      domain: getOnboardingDomainContract(),
    };
  }

  // One active Project per handoff / customer+tenant (Phase 21 Wave 1)
  if (typeof prisma.customerOnboardingProject.findFirst === 'function') {
    let activeOther = null;
    if (request.handoffId) {
      activeOther = await prisma.customerOnboardingProject.findFirst({
        where: {
          handoffId: String(request.handoffId),
          status: { notIn: [...ACTIVE_PROJECT_EXCLUSIONS] },
        },
      });
    }
    if (!activeOther && request.customerId && request.tenantId) {
      activeOther = await prisma.customerOnboardingProject.findFirst({
        where: {
          customerId: String(request.customerId),
          tenantId: String(request.tenantId),
          status: { notIn: [...ACTIVE_PROJECT_EXCLUSIONS] },
        },
      });
    }
    if (activeOther) {
      return {
        ok: false,
        error: 'active_project_exists',
        existingProjectId: activeOther.id,
      };
    }
  }

  if (
    request.status !== ONBOARDING_REQUEST_STATUS.ACCEPTED &&
    request.status !== ONBOARDING_REQUEST_STATUS.CONVERTED_TO_PROJECT
  ) {
    return {
      ok: false,
      error: `invalid_status_for_project_create: ${request.status}`,
    };
  }

  const allocated = await allocateOnboardingProjectNumber(prisma, { now });
  if (!allocated.ok) {
    return {
      ok: false,
      error: allocated.error || 'onboarding_project_number_allocation_failed',
    };
  }

  let row;
  try {
    row = await prisma.customerOnboardingProject.create({
      data: {
        onboardingNumber: allocated.number,
        status: ONBOARDING_PROJECT_STATUS.DRAFT,
        onboardingType: request.onboardingType || ONBOARDING_TYPE.STANDARD,
        onboardingRequestId,
        handoffId: request.handoffId || null,
        conversionId: request.conversionId || null,
        customerId: request.customerId,
        tenantId: request.tenantId,
        subscriptionId: request.subscriptionId,
        templateVersionId: String(templateVersionId),
        targetKickoffDate: args.targetKickoffDate
          ? new Date(args.targetKickoffDate)
          : null,
        targetGoLiveDate: args.targetGoLiveDate
          ? new Date(args.targetGoLiveDate)
          : null,
        ownerAssignmentsJson: ownerAssignments,
        csOwnerAdminId,
        ownerAdminId,
        inputHash,
        idempotencyKey,
        createdByAdminId: admin?.id || null,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    // Race: resolve existing Project by idempotency key OR onboardingRequestId
    try {
      let raced = await prisma.customerOnboardingProject.findUnique({
        where: { idempotencyKey },
      });
      if (!raced) {
        raced = await prisma.customerOnboardingProject.findFirst({
          where: { onboardingRequestId },
        });
      }
      if (raced) {
        if (
          raced.idempotencyKey === idempotencyKey &&
          raced.inputHash &&
          raced.inputHash !== inputHash
        ) {
          return {
            ok: false,
            error: 'idempotency_conflict',
            existingInputHash: raced.inputHash,
            attemptedInputHash: inputHash,
          };
        }
        await ensureRequestConvertedToProject(prisma, {
          admin,
          actorContext: args.actorContext,
          request,
          project: raced,
          now,
        });
        return {
          ok: true,
          project: serializeOnboardingProject(raced),
          alreadyExists: true,
          idempotentReplay: true,
          onboardingCompleted: false,
          workstreamsMaterialised: false,
          domain: getOnboardingDomainContract(),
        };
      }
    } catch {
      // fall through
    }
    return { ok: false, error: err?.message || 'onboarding_project_create_failed' };
  }

  await ensureRequestConvertedToProject(prisma, {
    admin,
    actorContext: args.actorContext,
    request,
    project: row,
    now,
  });

  return {
    ok: true,
    project: serializeOnboardingProject(row),
    onboardingCompleted: false,
    workstreamsMaterialised: false,
    domain: getOnboardingDomainContract(),
  };
}

export async function listOnboardingProjects(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canViewOnboarding(admin) && !canManageOnboarding(admin)) {
    return {
      ok: false,
      forbidden: true,
      error: 'onboarding_list_forbidden',
      projects: [],
    };
  }
  if (!hasCustomerOnboardingProjectModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_project_model_unavailable',
      status: 'UNAVAILABLE',
      projects: [],
    };
  }

  const scopeResult = await resolveOnboardingListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    if (scopeResult.forbidden) {
      return {
        ok: false,
        forbidden: true,
        error: 'onboarding_list_forbidden',
        projects: [],
      };
    }
    return {
      ok: true,
      projects: [],
      reason: scopeResult.reason,
      meta: { portfolioScoped: true, failClosed: true },
      domain: getOnboardingDomainContract(),
    };
  }

  const where = { ...tenantWhereFromScope(scopeResult.tenantScope) };
  const rows = await prisma.customerOnboardingProject.findMany({ where });
  return {
    ok: true,
    projects: rows.map(serializeOnboardingProject),
    meta: {
      portfolioScoped: scopeResult.portfolioScoped,
      failClosed: scopeResult.portfolioScoped,
    },
    domain: getOnboardingDomainContract(),
  };
}
