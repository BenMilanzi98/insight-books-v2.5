/**
 * Adoption ↔ Phase 8 intervention links — Phase 19 Wave 3.
 * Link only; do not re-implement Phase 8 intervention / playbook engines.
 */

import {
  ADOPTION_DORMANCY_STATUS,
  getAdoptionDomainContract,
} from './catalogue.js';
import {
  canManageAdoption,
  hasCsInterventionModel,
  hasCustomerAdoptionDormancyCaseModel,
  hasCustomerAdoptionInterventionLinkModel,
  resolveAdoptionActor,
  serializeAdoptionDormancyCase,
  serializeAdoptionInterventionLink,
} from './model.js';
import { loadAdoptionPlanForActor } from './planAccess.js';

/**
 * Link a real Phase 8 CsIntervention id onto a dormancy recovery case.
 */
export async function linkPhase8Intervention(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, error: 'adoption_intervention_link_forbidden' };
  }
  if (!hasCustomerAdoptionDormancyCaseModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_dormancy_case_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  if (!hasCustomerAdoptionInterventionLinkModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_intervention_link_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const planId = args.planId || args.adoptionPlanId
    ? String(args.planId || args.adoptionPlanId).trim()
    : '';
  const dormancyCaseId = args.dormancyCaseId || args.caseId
    ? String(args.dormancyCaseId || args.caseId).trim()
    : '';
  const interventionId = args.interventionId
    ? String(args.interventionId).trim()
    : '';

  if (!planId) return { ok: false, error: 'planId_required' };
  if (!dormancyCaseId) return { ok: false, error: 'dormancyCaseId_required' };
  if (!interventionId) {
    return { ok: false, error: 'PHASE_8_INTERVENTION_ID_REQUIRED' };
  }

  const access = await loadAdoptionPlanForActor(prisma, { ...args, planId });
  if (!access.ok) return access;

  const dormancyCase = await prisma.customerAdoptionDormancyCase.findUnique({
    where: { id: dormancyCaseId },
  });
  if (!dormancyCase || dormancyCase.planId !== planId) {
    return { ok: false, notFound: true, error: 'dormancy_case_not_found' };
  }

  if (!hasCsInterventionModel(prisma)) {
    return {
      ok: false,
      error: 'cs_intervention_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const intervention =
    (await prisma.csIntervention.findUnique({ where: { id: interventionId } })) ||
    (typeof prisma.csIntervention.findFirst === 'function'
      ? await prisma.csIntervention.findFirst({ where: { id: interventionId } })
      : null);

  if (!intervention) {
    return {
      ok: false,
      error: 'intervention_not_found',
      message: 'Phase 8 intervention id not found — link requires a real CsIntervention',
    };
  }

  const existing = await prisma.customerAdoptionInterventionLink.findFirst({
    where: { dormancyCaseId, interventionId },
  });
  if (existing) {
    return {
      ok: true,
      link: serializeAdoptionInterventionLink(existing),
      case: serializeAdoptionDormancyCase(dormancyCase),
      alreadyExists: true,
      domain: getAdoptionDomainContract(),
    };
  }

  const now = args.now || new Date();
  const link = await prisma.customerAdoptionInterventionLink.create({
    data: {
      planId,
      dormancyCaseId,
      interventionId,
      playbookExecutionId: args.playbookExecutionId
        ? String(args.playbookExecutionId).trim()
        : null,
      outcomeAttestationJson:
        args.outcomeAttestation && typeof args.outcomeAttestation === 'object'
          ? args.outcomeAttestation
          : null,
      createdByAdminId: admin?.id || null,
      createdAt: now,
    },
  });

  const nextStatus =
    dormancyCase.status === ADOPTION_DORMANCY_STATUS.OPEN ||
    dormancyCase.status === ADOPTION_DORMANCY_STATUS.MONITORING
      ? ADOPTION_DORMANCY_STATUS.INTERVENTION_LINKED
      : dormancyCase.status;

  const updated = await prisma.customerAdoptionDormancyCase.update({
    where: { id: dormancyCaseId },
    data: {
      status: nextStatus,
      interventionId,
      playbookExecutionId: args.playbookExecutionId
        ? String(args.playbookExecutionId).trim()
        : dormancyCase.playbookExecutionId || null,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    link: serializeAdoptionInterventionLink(link),
    case: serializeAdoptionDormancyCase(updated),
    created: true,
    domain: getAdoptionDomainContract(),
  };
}
