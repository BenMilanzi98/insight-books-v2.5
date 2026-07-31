/**
 * Stabilisation exit criteria + approval — Phase 21 Wave 3.
 * Short-term early-life; distinct from Phase 35 hypercare.
 * Exit approval must not invent EXITED without prior checks / criteria.
 */

import { loadOnboardingProjectForActor } from './projectAccess.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingStabilisationModel,
  serializeOnboardingStabilisation,
} from './model.js';
import { getOnboardingDomainContract, ONBOARDING_PROJECT_STATUS } from './catalogue.js';
import { transitionOnboardingProjectStatus } from './status.js';

function auditedExitWaiver(args = {}) {
  const waiver = args.exitCriteriaWaiver || args.typePolicy?.stabilisationExit;
  if (!waiver || waiver.waived !== true) return null;
  const approvedBy = waiver.approvedByAdminId || waiver.approvedBy || null;
  const reason = waiver.reason ? String(waiver.reason).trim() : '';
  if (!approvedBy || !reason) return null;
  return {
    waived: true,
    approvedByAdminId: String(approvedBy),
    reason,
    audited: true,
  };
}

/**
 * Exit criteria met when explicit met/satisfied, or criticalDefects === 0 with checks recorded.
 */
export function stabilisationExitCriteriaMet(row, args = {}) {
  const waiver = auditedExitWaiver(args);
  if (waiver) return { ok: true, waived: true, waiver };

  if (!row) {
    return { ok: false, error: 'stabilisation_record_required' };
  }

  const criteria = row.exitCriteriaJson;
  if (!criteria || typeof criteria !== 'object' || Array.isArray(criteria)) {
    return {
      ok: false,
      error: 'stabilisation_exit_criteria_required',
      hint: 'recordStabilisationCheck with exitCriteriaJson before approveStabilisationExit',
    };
  }

  if (criteria.met === true || criteria.satisfied === true || criteria.ready === true) {
    return { ok: true, waived: false };
  }

  const hasChecks =
    row.checksJson != null &&
    (typeof row.checksJson === 'object'
      ? Object.keys(row.checksJson).length > 0
      : true);

  if (
    Object.prototype.hasOwnProperty.call(criteria, 'criticalDefects') &&
    Number(criteria.criticalDefects) === 0 &&
    hasChecks
  ) {
    return { ok: true, waived: false };
  }

  if (hasChecks && criteria.exitReady === true) {
    return { ok: true, waived: false };
  }

  return {
    ok: false,
    error: 'stabilisation_exit_criteria_not_met',
    hint: 'Set exitCriteriaJson.met / criticalDefects:0 with checksJson, or audited waiver',
  };
}

export async function recordStabilisationCheck(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;
  if (!canManageOnboarding(loaded.admin)) {
    return {
      ok: false,
      forbidden: true,
      error: 'onboarding_stabilisation_forbidden',
    };
  }
  if (!hasCustomerOnboardingStabilisationModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_stabilisation_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const now = args.now || new Date();
  const existing = await prisma.customerOnboardingStabilisation.findFirst({
    where: { projectId: loaded.project.id },
  });

  const data = {
    projectId: loaded.project.id,
    status: String(args.status || existing?.status || 'IN_PROGRESS')
      .trim()
      .toUpperCase(),
    checksJson:
      args.checksJson !== undefined ? args.checksJson : existing?.checksJson,
    exitCriteriaJson:
      args.exitCriteriaJson !== undefined
        ? args.exitCriteriaJson
        : existing?.exitCriteriaJson,
    updatedAt: now,
  };

  const row = existing
    ? await prisma.customerOnboardingStabilisation.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.customerOnboardingStabilisation.create({
        data: {
          ...data,
          createdByAdminId: loaded.admin?.id || null,
          createdAt: now,
        },
      });

  return {
    ok: true,
    stabilisation: {
      ...serializeOnboardingStabilisation(row),
      hypercare: false,
      phase35Hypercare: false,
    },
    domain: getOnboardingDomainContract(),
  };
}

export async function approveStabilisationExit(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;
  if (!canManageOnboarding(loaded.admin)) {
    return {
      ok: false,
      forbidden: true,
      error: 'onboarding_stabilisation_forbidden',
    };
  }
  if (!hasCustomerOnboardingStabilisationModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_stabilisation_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const row = await prisma.customerOnboardingStabilisation.findFirst({
    where: { projectId: loaded.project.id },
  });

  // Never invent EXITED with no prior stabilisation record / checks.
  if (!row) {
    return {
      ok: false,
      error: 'stabilisation_record_required',
      hint: 'recordStabilisationCheck before approveStabilisationExit',
    };
  }

  const criteriaGate = stabilisationExitCriteriaMet(row, args);
  if (!criteriaGate.ok) return criteriaGate;

  const now = args.now || new Date();
  const updated = await prisma.customerOnboardingStabilisation.update({
    where: { id: row.id },
    data: {
      status: 'EXITED',
      exitApprovedAt: now,
      exitApprovedByAdminId: loaded.admin?.id || null,
      exitWaiverJson: criteriaGate.waiver || null,
      updatedAt: now,
    },
  });

  if (loaded.project.status === ONBOARDING_PROJECT_STATUS.STABILISATION) {
    await transitionOnboardingProjectStatus(prisma, {
      ...args,
      projectId: loaded.project.id,
      toStatus: ONBOARDING_PROJECT_STATUS.HANDOVER_PENDING,
      reason: 'stabilisation_exit_approved',
      now,
    });
  }

  return {
    ok: true,
    stabilisation: {
      ...serializeOnboardingStabilisation(updated),
      hypercare: false,
      phase35Hypercare: false,
    },
    exitWaived: criteriaGate.waived === true,
    domain: getOnboardingDomainContract(),
  };
}
