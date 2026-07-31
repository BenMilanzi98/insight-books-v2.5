import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  listOnboardingProjects,
  createOnboardingProject,
  ensureWave1StandardTemplateVersion,
  hasCustomerOnboardingProjectModel,
  materialiseOnboardingTemplate,
  scheduleOnboardingKickoff,
  assignOnboardingStakeholder,
  confirmOnboardingRequirements,
  detectScopeMismatch,
  submitCustomerTaskEvidence,
  reviewCustomerTaskEvidence,
  completeOnboardingTask,
  approveOnboardingTemplateVersion,
  activateOnboardingTemplateVersion,
  evaluateOnboardingReadiness,
  setMigrationCoordinationStatus,
  setTrainingCoordinationStatus,
  setMraEisCoordinationStatus,
  recordOnboardingDefect,
  approveGoLive,
  executeGoLive,
  recordGoLiveOutcome,
  createOnboardingHandover,
  acceptOnboardingHandover,
  evaluateOnboardingCompletion,
  issueCompletionCertificate,
  calculateOnboardingProgress,
  calculateOnboardingHealth,
  approveStabilisationExit,
} from '@/lib/admin/customerSuccess/onboarding';

function fail(result) {
  return NextResponse.json(
    { success: false, error: result.error || result.reason || 'action_failed' },
    {
      status:
        result.status === 'UNAVAILABLE'
          ? 503
          : result.forbidden
            ? 403
            : result.notFound
              ? 404
              : 400,
    }
  );
}

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasCustomerOnboardingProjectModel(prisma)) {
      return NextResponse.json(
        {
          success: false,
          error: 'customer_onboarding_project_model_unavailable',
          status: 'UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    const result = await listOnboardingProjects(prisma, {
      admin,
      actorContext: { admin },
    });
    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    return NextResponse.json({
      success: true,
      ...result,
      hint: 'Wave 3 — readiness / go-live / completion / migration via POST actions',
    });
  } catch (error) {
    console.error('CS onboarding projects list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list onboarding projects' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'create').trim().toLowerCase();
    const ctx = { admin, actorContext: { admin } };

    if (action === 'ensure-template' || action === 'seed-template') {
      const result = await ensureWave1StandardTemplateVersion(prisma, ctx);
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'approve-template-version') {
      const result = await approveOnboardingTemplateVersion(prisma, {
        ...ctx,
        templateVersionId: body.templateVersionId,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'activate-template-version') {
      const result = await activateOnboardingTemplateVersion(prisma, {
        ...ctx,
        templateVersionId: body.templateVersionId,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'materialise') {
      const result = await materialiseOnboardingTemplate(prisma, {
        ...ctx,
        projectId: body.projectId,
        templateVersionId: body.templateVersionId,
        idempotencyKey: body.idempotencyKey,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'schedule-kickoff' || action === 'kickoff') {
      const result = await scheduleOnboardingKickoff(prisma, {
        ...ctx,
        projectId: body.projectId,
        meetingInput: body.meetingInput || body,
        idempotencyKey: body.idempotencyKey,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'assign-stakeholder') {
      const result = await assignOnboardingStakeholder(prisma, {
        ...ctx,
        projectId: body.projectId,
        contactId: body.contactId,
        role: body.role,
        required: body.required,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'confirm-requirements') {
      const result = await confirmOnboardingRequirements(prisma, {
        ...ctx,
        projectId: body.projectId,
        confirmedScope: body.confirmedScope,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'detect-scope-mismatch') {
      const result = await detectScopeMismatch(prisma, {
        ...ctx,
        projectId: body.projectId,
        requestedScope: body.requestedScope,
        confirmedScope: body.confirmedScope,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'submit-evidence') {
      const result = await submitCustomerTaskEvidence(prisma, {
        ...ctx,
        taskId: body.taskId,
        attestationReason: body.attestationReason,
        contactId: body.contactId,
        fileRef: body.fileRef,
        note: body.note,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'review-evidence') {
      const result = await reviewCustomerTaskEvidence(prisma, {
        ...ctx,
        evidenceId: body.evidenceId,
        decision: body.decision,
        reason: body.reason,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'complete-task') {
      const result = await completeOnboardingTask(prisma, {
        ...ctx,
        taskId: body.taskId,
        authorisedWaiver: body.authorisedWaiver,
        waiverReason: body.waiverReason,
        completionSource: body.completionSource,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'evaluate-readiness') {
      const result = await evaluateOnboardingReadiness(prisma, {
        ...ctx,
        projectId: body.projectId,
        tenantId: body.tenantId,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'set-migration-status') {
      const result = await setMigrationCoordinationStatus(prisma, {
        ...ctx,
        projectId: body.projectId,
        status: body.status,
        reconciliationStatus: body.reconciliationStatus,
        fileInventoryJson: body.fileInventoryJson,
        securityFlagsJson: body.securityFlagsJson,
        tenantId: body.tenantId,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'set-training-status') {
      const result = await setTrainingCoordinationStatus(prisma, {
        ...ctx,
        projectId: body.projectId,
        status: body.status,
        sourceDomain: body.sourceDomain,
        trainingDomainSource: body.trainingDomainSource,
        trainingDomainStatus: body.trainingDomainStatus,
        tenantId: body.tenantId,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'set-mra-status') {
      const result = await setMraEisCoordinationStatus(prisma, {
        ...ctx,
        projectId: body.projectId,
        status: body.status,
        credentialStatus: body.credentialStatus,
        testApprovalRef: body.testApprovalRef,
        productionApprovalRef: body.productionApprovalRef,
        tenantId: body.tenantId,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'record-defect') {
      const result = await recordOnboardingDefect(prisma, {
        ...ctx,
        projectId: body.projectId,
        title: body.title,
        description: body.description,
        severity: body.severity,
        status: body.status,
        tenantId: body.tenantId,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'approve-go-live') {
      const result = await approveGoLive(prisma, {
        ...ctx,
        projectId: body.projectId,
        approvalRole: body.approvalRole,
        tenantId: body.tenantId,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'execute-go-live') {
      const result = await executeGoLive(prisma, {
        ...ctx,
        projectId: body.projectId,
        windowStart: body.windowStart,
        windowEnd: body.windowEnd,
        idempotencyKey: body.idempotencyKey,
        tenantId: body.tenantId,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'record-go-live-outcome') {
      const result = await recordGoLiveOutcome(prisma, {
        ...ctx,
        projectId: body.projectId,
        outcome: body.outcome,
        customerAcknowledged: body.customerAcknowledged,
        rollbackDecision: body.rollbackDecision,
        tenantId: body.tenantId,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'approve-stabilisation-exit') {
      const result = await approveStabilisationExit(prisma, {
        ...ctx,
        projectId: body.projectId,
        tenantId: body.tenantId,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'create-handover') {
      const result = await createOnboardingHandover(prisma, {
        ...ctx,
        projectId: body.projectId,
        recipients: body.recipients,
        openItemsJson: body.openItemsJson,
        idempotencyKey: body.idempotencyKey,
        tenantId: body.tenantId,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'accept-handover') {
      const result = await acceptOnboardingHandover(prisma, {
        ...ctx,
        projectId: body.projectId,
        handoverId: body.handoverId,
        tenantId: body.tenantId,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'evaluate-completion') {
      const result = await evaluateOnboardingCompletion(prisma, {
        ...ctx,
        projectId: body.projectId,
        tenantId: body.tenantId,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'issue-completion-certificate') {
      const result = await issueCompletionCertificate(prisma, {
        ...ctx,
        projectId: body.projectId,
        idempotencyKey: body.idempotencyKey,
        tenantId: body.tenantId,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'calculate-progress') {
      const result = await calculateOnboardingProgress(prisma, {
        ...ctx,
        projectId: body.projectId,
        tenantId: body.tenantId,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'calculate-health') {
      const result = await calculateOnboardingHealth(prisma, {
        ...ctx,
        projectId: body.projectId,
        tenantId: body.tenantId,
      });
      if (!result.ok) return fail(result);
      return NextResponse.json({ success: true, ...result });
    }

    const result = await createOnboardingProject(prisma, {
      ...ctx,
      onboardingRequestId: body.onboardingRequestId,
      onboardingTemplateVersionId:
        body.onboardingTemplateVersionId || body.templateVersionId,
      targetKickoffDate: body.targetKickoffDate,
      targetGoLiveDate: body.targetGoLiveDate,
      ownerAssignments: body.ownerAssignments,
      idempotencyKey: body.idempotencyKey,
    });

    if (!result.ok) return fail(result);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CS onboarding project action error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed onboarding project action' },
      { status: 500 }
    );
  }
}
