/**
 * Onboarding completion evaluation + immutable certificate — Phase 21 Wave 3.
 * Requires successful go-live, stabilisation exit, Customer + internal sign-off,
 * recon, and handover; checksum stable on exact retry.
 * Certificate issuance does not silently waive go-live via typePolicy.
 */

import { createHash } from 'crypto';
import { loadOnboardingProjectForActor } from './projectAccess.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingCompletionCertificateModel,
  serializeOnboardingCompletion,
  serializeOnboardingCompletionCertificate,
} from './model.js';
import { getOnboardingDomainContract, ONBOARDING_PROJECT_STATUS } from './catalogue.js';
import { transitionOnboardingProjectStatus } from './status.js';

const RECON_OK = new Set(['PASSED', 'COMPLETE', 'OK', 'APPROVED']);
const GO_LIVE_OK = new Set(['SUCCESSFUL', 'COMPLETED']);
const STABILISATION_EXITED = new Set(['EXITED', 'COMPLETE', 'COMPLETED']);

export function computeOnboardingCompletionChecksum(payload = {}) {
  const canonical = {
    projectId: payload.projectId || null,
    onboardingNumber: payload.onboardingNumber || null,
    tenantId: payload.tenantId || null,
    customerId: payload.customerId || null,
    customerSignOffAt: payload.customerSignOffAt || null,
    internalSignOffAt: payload.internalSignOffAt || null,
    handoverId: payload.handoverId || null,
    reconciliationStatus: payload.reconciliationStatus || null,
    goLiveOutcome: payload.goLiveOutcome || null,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

async function loadCompletionContext(prisma, project) {
  const completion =
    typeof prisma.customerOnboardingCompletion?.findFirst === 'function'
      ? await prisma.customerOnboardingCompletion.findFirst({
          where: { projectId: project.id },
        })
      : null;
  const handover =
    typeof prisma.customerOnboardingHandover?.findFirst === 'function'
      ? await prisma.customerOnboardingHandover.findFirst({
          where: { projectId: project.id },
        })
      : null;
  const migration =
    typeof prisma.customerOnboardingMigration?.findFirst === 'function'
      ? await prisma.customerOnboardingMigration.findFirst({
          where: { projectId: project.id },
        })
      : null;
  const goLive =
    typeof prisma.customerOnboardingGoLive?.findFirst === 'function'
      ? await prisma.customerOnboardingGoLive.findFirst({
          where: { projectId: project.id },
        })
      : null;
  const stabilisation =
    typeof prisma.customerOnboardingStabilisation?.findFirst === 'function'
      ? await prisma.customerOnboardingStabilisation.findFirst({
          where: { projectId: project.id },
        })
      : null;

  return { completion, handover, migration, goLive, stabilisation };
}

function typePolicyWaives(args, key) {
  const policy = args.typePolicy || args.completionPolicy || {};
  const waiver = policy[key];
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

export async function evaluateOnboardingCompletion(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;

  const ctx = await loadCompletionContext(prisma, loaded.project);
  const blockers = [];
  const waivers = [];

  if (!ctx.completion?.customerSignOffAt) {
    blockers.push('customer_sign_off_required');
  }
  if (!ctx.completion?.internalSignOffAt) {
    blockers.push('internal_sign_off_required');
  }

  const handoverAccepted =
    ctx.handover &&
    String(ctx.handover.status || '').toUpperCase() === 'ACCEPTED';
  if (!handoverAccepted) {
    blockers.push('handover_acceptance_required');
  }

  const recon = String(
    ctx.completion?.reconciliationStatus ||
      ctx.migration?.reconciliationStatus ||
      ''
  ).toUpperCase();
  if (!RECON_OK.has(recon)) {
    blockers.push('reconciliation_required');
  }

  // Go-live SUCCESSFUL required. Certificate issuance ignores typePolicy go-live
  // waivers unless allowGoLiveWaiverForCertificate (audited control flag).
  const goLiveWaiver = typePolicyWaives(args, 'goLive');
  const goLiveOk =
    ctx.goLive &&
    GO_LIVE_OK.has(String(ctx.goLive.outcome || ctx.goLive.status || '').toUpperCase());
  const requireGoLive = args.requireGoLive !== false;
  if (requireGoLive && !goLiveOk) {
    const certPath = args.certificateIssuance === true;
    if (
      goLiveWaiver &&
      certPath &&
      args.allowGoLiveWaiverForCertificate === true
    ) {
      waivers.push({
        dimension: 'goLive',
        ...goLiveWaiver,
        certificateControlFlag: true,
      });
    } else if (goLiveWaiver && !certPath) {
      waivers.push({ dimension: 'goLive', ...goLiveWaiver });
    } else if (goLiveWaiver && certPath) {
      blockers.push('go_live_successful_required');
      blockers.push('go_live_waiver_requires_certificate_control_flag');
    } else {
      blockers.push('go_live_successful_required');
    }
  }

  // Required stabilisation exit unless type policy explicitly waives with audit.
  const stabWaiver = typePolicyWaives(args, 'stabilisation');
  const stabOk =
    ctx.stabilisation &&
    STABILISATION_EXITED.has(String(ctx.stabilisation.status || '').toUpperCase());
  const requireStabilisation = args.requireStabilisation !== false;
  if (requireStabilisation && !stabOk) {
    if (stabWaiver) {
      waivers.push({ dimension: 'stabilisation', ...stabWaiver });
    } else {
      blockers.push('stabilisation_exit_required');
    }
  }

  const ready = blockers.length === 0;

  return {
    ok: true,
    projectId: loaded.project.id,
    ready,
    complete: ready,
    blockers,
    waivers,
    domain: getOnboardingDomainContract(),
  };
}

export async function issueCompletionCertificate(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;
  if (!canManageOnboarding(loaded.admin)) {
    return {
      ok: false,
      forbidden: true,
      error: 'onboarding_completion_forbidden',
    };
  }
  if (!hasCustomerOnboardingCompletionCertificateModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_completion_certificate_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  if (!idempotencyKey) {
    return { ok: false, error: 'idempotencyKey_required' };
  }

  const existing = await prisma.customerOnboardingCompletionCertificate.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    if (existing.projectId !== loaded.project.id) {
      return { ok: false, error: 'idempotency_conflict' };
    }
    return {
      ok: true,
      alreadyExists: true,
      idempotentReplay: true,
      certificate: serializeOnboardingCompletionCertificate(existing),
      created: false,
    };
  }

  // Never skip go-live / stabilisation for certificate issuance.
  // certificateIssuance blocks silent typePolicy go-live waivers.
  const evaluation = await evaluateOnboardingCompletion(prisma, {
    ...args,
    projectId: loaded.project.id,
    requireGoLive: true,
    requireStabilisation: true,
    certificateIssuance: true,
  });
  if (!evaluation.ready) {
    return {
      ok: false,
      error: 'completion_not_ready',
      blockers: evaluation.blockers,
      waivers: evaluation.waivers,
    };
  }

  const ctx = await loadCompletionContext(prisma, loaded.project);
  const canonical = {
    projectId: loaded.project.id,
    onboardingNumber:
      loaded.project.onboardingNumber || loaded.project.number || null,
    tenantId: loaded.project.tenantId || null,
    customerId: loaded.project.customerId || null,
    customerSignOffAt: ctx.completion?.customerSignOffAt
      ? new Date(ctx.completion.customerSignOffAt).toISOString()
      : null,
    internalSignOffAt: ctx.completion?.internalSignOffAt
      ? new Date(ctx.completion.internalSignOffAt).toISOString()
      : null,
    handoverId: ctx.handover?.id || null,
    reconciliationStatus:
      ctx.completion?.reconciliationStatus ||
      ctx.migration?.reconciliationStatus ||
      null,
    goLiveOutcome: ctx.goLive?.outcome || ctx.goLive?.status || null,
  };
  const checksumSha256 = computeOnboardingCompletionChecksum(canonical);
  const now = args.now || new Date();

  const openGaps =
    (Array.isArray(ctx.handover?.openItemsJson) &&
      ctx.handover.openItemsJson.length > 0) ||
    (Array.isArray(args.openGaps) && args.openGaps.length > 0);
  const completedWithGaps =
    openGaps === true && args.allowCompletedWithGaps !== false;
  // Explicit COMPLETED_WITH_GAPS — never silently collapse to COMPLETED.
  const completionStatus = completedWithGaps
    ? ONBOARDING_PROJECT_STATUS.COMPLETED_WITH_GAPS
    : ONBOARDING_PROJECT_STATUS.COMPLETED;

  if (openGaps && args.allowCompletedWithGaps === false) {
    return {
      ok: false,
      error: 'completion_has_open_gaps',
      hint: 'Pass allowCompletedWithGaps to issue COMPLETED_WITH_GAPS explicitly',
      openGaps: ctx.handover?.openItemsJson || args.openGaps,
    };
  }

  const row = await prisma.customerOnboardingCompletionCertificate.create({
    data: {
      projectId: loaded.project.id,
      checksumSha256,
      status: 'ISSUED',
      idempotencyKey,
      payloadJson: {
        ...canonical,
        waivers: evaluation.waivers || [],
        completedWithGaps,
        completionStatus,
        openGaps: ctx.handover?.openItemsJson || args.openGaps || null,
        note: 'Onboarding completion certificate — progress % alone never equals completion; go-live alone never equals completion',
      },
      createdByAdminId: loaded.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  if (
    loaded.project.status === ONBOARDING_PROJECT_STATUS.COMPLETION_PENDING &&
    typeof prisma.customerOnboardingProject?.update === 'function'
  ) {
    try {
      await transitionOnboardingProjectStatus(prisma, {
        ...args,
        projectId: loaded.project.id,
        toStatus: completionStatus,
        reason: completedWithGaps
          ? 'completion_certificate_issued_with_gaps'
          : 'completion_certificate_issued',
        now,
      });
    } catch {
      /* status history optional in harness */
    }
  }

  return {
    ok: true,
    created: true,
    completedWithGaps,
    completionStatus,
    certificate: serializeOnboardingCompletionCertificate(row),
    completion: serializeOnboardingCompletion(ctx.completion),
    domain: getOnboardingDomainContract(),
  };
}
