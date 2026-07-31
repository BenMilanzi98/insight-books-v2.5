/**
 * Materialise template version → Workstreams / Milestones / Tasks / Checklists once.
 * Exact retry returns existing materialisation; never duplicates children.
 */

import { getOnboardingDomainContract } from './catalogue.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingMaterialisationModel,
  hasCustomerOnboardingProjectModel,
  hasCustomerOnboardingTemplateVersionModel,
  resolveOnboardingActor,
  serializeOnboardingMaterialisation,
} from './model.js';

function contentOf(version) {
  const c = version?.contentJson;
  if (!c || typeof c !== 'object') {
    return { workstreams: [], milestones: [], tasks: [], checklists: [] };
  }
  return {
    workstreams: Array.isArray(c.workstreams) ? c.workstreams : [],
    milestones: Array.isArray(c.milestones) ? c.milestones : [],
    tasks: Array.isArray(c.tasks) ? c.tasks : [],
    checklists: Array.isArray(c.checklists) ? c.checklists : [],
  };
}

/**
 * @param {object} prisma
 * @param {{ projectId, templateVersionId, idempotencyKey, actorContext?, admin?, now? }} args
 */
export async function materialiseOnboardingTemplate(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_materialise_forbidden' };
  }
  if (!hasCustomerOnboardingProjectModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_project_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  if (!hasCustomerOnboardingTemplateVersionModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_template_version_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  if (!hasCustomerOnboardingMaterialisationModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_materialisation_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const projectId = args.projectId ? String(args.projectId).trim() : '';
  const templateVersionId = args.templateVersionId
    ? String(args.templateVersionId).trim()
    : '';
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  if (!projectId) return { ok: false, error: 'projectId_required' };
  if (!templateVersionId) return { ok: false, error: 'templateVersionId_required' };
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };

  const existingByKey = await prisma.customerOnboardingMaterialisation.findUnique({
    where: { idempotencyKey },
  }).catch(async () =>
    prisma.customerOnboardingMaterialisation.findFirst({
      where: { idempotencyKey },
    })
  );
  if (existingByKey) {
    if (
      String(existingByKey.projectId) !== projectId ||
      String(existingByKey.templateVersionId) !== templateVersionId
    ) {
      return {
        ok: false,
        error: 'idempotency_conflict',
        existingProjectId: existingByKey.projectId,
        attemptedProjectId: projectId,
        existingTemplateVersionId: existingByKey.templateVersionId,
        attemptedTemplateVersionId: templateVersionId,
      };
    }
    return {
      ok: true,
      materialisation: serializeOnboardingMaterialisation(existingByKey),
      alreadyExists: true,
      idempotentReplay: true,
      domain: getOnboardingDomainContract(),
    };
  }

  const project = await prisma.customerOnboardingProject.findUnique({
    where: { id: projectId },
  });
  if (!project) return { ok: false, error: 'project_not_found' };

  const pinId = project.templateVersionId ? String(project.templateVersionId) : '';
  if (pinId && pinId !== templateVersionId) {
    return {
      ok: false,
      error: 'template_version_mismatch',
      existingTemplateVersionId: pinId,
      attemptedTemplateVersionId: templateVersionId,
    };
  }

  const existingByProject = await prisma.customerOnboardingMaterialisation.findFirst({
    where: { projectId },
  });
  if (existingByProject) {
    if (
      existingByProject.templateVersionId &&
      String(existingByProject.templateVersionId) !== templateVersionId
    ) {
      return {
        ok: false,
        error: 'template_version_mismatch',
        existingTemplateVersionId: existingByProject.templateVersionId,
        attemptedTemplateVersionId: templateVersionId,
      };
    }
    return {
      ok: true,
      materialisation: serializeOnboardingMaterialisation(existingByProject),
      alreadyExists: true,
      idempotentReplay: true,
      domain: getOnboardingDomainContract(),
    };
  }

  const version = await prisma.customerOnboardingTemplateVersion.findUnique({
    where: { id: templateVersionId },
  });
  if (!version) return { ok: false, error: 'template_version_not_found' };

  const content = contentOf(version);
  const now = args.now || new Date();

  const run = async (tx) => {
    const workstreamByCode = new Map();

    for (const ws of content.workstreams) {
      const code = String(ws.code || ws.name || '').trim().toUpperCase();
      if (!code) continue;
      const row = await tx.customerOnboardingWorkstream.create({
        data: {
          projectId,
          templateVersionId,
          code,
          name: ws.name || code,
          sequence: ws.sequence != null ? Number(ws.sequence) : 0,
          status: 'OPEN',
          createdAt: now,
          updatedAt: now,
        },
      });
      workstreamByCode.set(code, row);
    }

    for (const ms of content.milestones) {
      const code = String(ms.code || ms.name || '').trim().toUpperCase();
      if (!code) continue;
      const wsCode = ms.workstreamCode
        ? String(ms.workstreamCode).trim().toUpperCase()
        : null;
      const workstreamId = wsCode ? workstreamByCode.get(wsCode)?.id || null : null;
      await tx.customerOnboardingMilestone.create({
        data: {
          projectId,
          workstreamId,
          templateVersionId,
          code,
          name: ms.name || code,
          sequence: ms.sequence != null ? Number(ms.sequence) : 0,
          required: ms.required !== false,
          status: 'OPEN',
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    for (const task of content.tasks) {
      const code = String(task.code || task.name || '').trim().toUpperCase();
      if (!code) continue;
      const wsCode = task.workstreamCode
        ? String(task.workstreamCode).trim().toUpperCase()
        : null;
      const workstreamId = wsCode ? workstreamByCode.get(wsCode)?.id || null : null;
      await tx.customerOnboardingTask.create({
        data: {
          projectId,
          workstreamId,
          templateVersionId,
          code,
          name: task.name || code,
          actorType: String(task.actorType || 'INTERNAL').toUpperCase(),
          sequence: task.sequence != null ? Number(task.sequence) : 0,
          status: 'OPEN',
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    for (const chk of content.checklists) {
      const code = String(chk.code || chk.name || '').trim().toUpperCase();
      if (!code) continue;
      const wsCode = chk.workstreamCode
        ? String(chk.workstreamCode).trim().toUpperCase()
        : null;
      const workstreamId = wsCode ? workstreamByCode.get(wsCode)?.id || null : null;
      await tx.customerOnboardingChecklist.create({
        data: {
          projectId,
          workstreamId,
          templateVersionId,
          code,
          name: chk.name || code,
          sequence: chk.sequence != null ? Number(chk.sequence) : 0,
          status: 'OPEN',
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    const materialisation = await tx.customerOnboardingMaterialisation.create({
      data: {
        projectId,
        templateVersionId,
        idempotencyKey,
        workstreamCount: content.workstreams.length,
        milestoneCount: content.milestones.length,
        taskCount: content.tasks.length,
        checklistCount: content.checklists.length,
        createdByAdminId: admin?.id || null,
        createdAt: now,
        updatedAt: now,
      },
    });

    return materialisation;
  };

  const materialisation = prisma.$transaction
    ? await prisma.$transaction(run)
    : await run(prisma);

  return {
    ok: true,
    materialisation: serializeOnboardingMaterialisation(materialisation),
    created: true,
    domain: getOnboardingDomainContract(),
  };
}
