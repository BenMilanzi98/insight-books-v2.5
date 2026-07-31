/**
 * Wave 2 provision spine — Customer / Tenant / Business / Branch / Contacts / Invites.
 * Runs after Closed Won. No Subscription / billing / activation.
 */

import {
  CRM_CONVERSION_STEP_CODE,
  CRM_CONVERSION_STEP_STATUS,
  CRM_CONVERSION_RESOURCE_TYPE,
  CRM_CUSTOMER_MATCH_STATE,
} from './catalogue.js';
import { assertNoTenantAccountingSideEffects } from './accountingBoundary.js';
import {
  createPrimaryBusinessBranch,
  linkContactsForConversion,
} from './businessBranch.js';
import {
  decideCustomerCreateOrLink,
  matchPlatformCustomer,
} from './customerMatch.js';
import { createOrLinkPlatformCustomer } from './customerProvision.js';
import { createInitialUserInvitation } from './invitations.js';
import {
  createOrLinkTenant,
  decideTenantCreateOrLink,
} from './tenantProvision.js';
import {
  beginStepOptimistic,
  ensureWave2Steps,
  isStepCompleted,
  markStepStatus,
  recordStepAttempt,
} from './steps.js';
import { lockConversionCommercialSnapshot } from './commercialSnapshot.js';

function findStep(steps, stepCode) {
  return steps.find((s) => s.stepCode === stepCode) || null;
}

async function loadSteps(prisma, conversionId) {
  return prisma.crmConversionStep.findMany({
    where: { conversionId },
    orderBy: { stepOrder: 'asc' },
  });
}

async function beginStep(prisma, step, now) {
  return beginStepOptimistic(prisma, { step, now });
}

async function findPlatformCustomerResource(prisma, conversionId) {
  if (
    !conversionId ||
    typeof prisma?.crmConversionResource?.findFirst !== 'function'
  ) {
    return null;
  }
  return prisma.crmConversionResource.findFirst({
    where: {
      conversionId,
      resourceType: CRM_CONVERSION_RESOURCE_TYPE.PLATFORM_CUSTOMER,
      idempotencyKey: `customer:${conversionId}`,
    },
  });
}

/**
 * Resolve customerId after a concurrency skip: re-read resource / step output,
 * or fail closed — never continue Wave 2 with null customerId.
 */
async function resolveCustomerAfterConcurrencySkip(prisma, step, conversionId) {
  const resource = await findPlatformCustomerResource(prisma, conversionId);
  if (resource?.resourceId) {
    return {
      ok: true,
      customerId: resource.resourceId,
      action: resource.action || null,
    };
  }
  const fromOutput = step?.outputJson?.provision?.customerId;
  if (fromOutput) {
    return {
      ok: true,
      customerId: fromOutput,
      action: step.outputJson.provision.action || null,
    };
  }
  return { ok: false, error: 'step_concurrency_conflict' };
}

async function completeStep(prisma, {
  conversion,
  step,
  inputHash,
  admin,
  now,
  outputJson,
  status = CRM_CONVERSION_STEP_STATUS.COMPLETED,
  errorCode = null,
  retryable = false,
}) {
  await recordStepAttempt(prisma, {
    conversionId: conversion.id,
    stepId: step.id,
    stepCode: step.stepCode,
    attemptNumber: step.attemptCount || 1,
    inputHash,
    status,
    outputJson,
    errorCode,
    actorAdminId: admin?.id || null,
    now,
  });
  await markStepStatus(prisma, step.id, {
    status,
    outputJson,
    errorCode,
    retryable,
    updatedAt: now,
  });
}

function planContent(planVersion) {
  const content = planVersion?.contentJson || {};
  return typeof content === 'object' && content ? content : {};
}

/**
 * Execute Wave 2 steps after Closed Won.
 */
export async function runWave2ProvisionSpine(prisma, {
  conversion,
  request,
  admin,
  planVersion = null,
  inputHash,
  now,
  args = {},
}) {
  await ensureWave2Steps(prisma, conversion.id, inputHash || conversion.inputHash, now);
  let steps = await loadSteps(prisma, conversion.id);
  const plan = planContent(planVersion);
  const flags = {
    customerCreated: false,
    customerLinked: false,
    tenantCreated: false,
    tenantLinked: false,
    businessCreated: false,
    branchCreated: false,
    invitationsCreated: 0,
  };

  let customerId = null;
  let tenantId = null;
  let blocked = false;
  let blockError = null;

  // --- Lock commercial snapshot (immutable conversion-time commercial truth) ---
  {
    const snap =
      plan.acceptedSnapshot ||
      plan.pricingSnapshot ||
      args.acceptedSnapshot ||
      null;
    if (snap) {
      await lockConversionCommercialSnapshot(prisma, {
        conversionId: conversion.id,
        acceptanceId: request.acceptanceId || snap.acceptanceId || null,
        documentVersionId: snap.documentVersionId || null,
        snapshot: snap,
        checksumSha256: snap.checksumSha256 || null,
        admin,
        now,
      });
    }
  }

  // --- Customer ---
  {
    const step = findStep(
      steps,
      CRM_CONVERSION_STEP_CODE.CREATE_OR_LINK_PLATFORM_CUSTOMER
    );
    const begun = await beginStep(prisma, step, now);
    if (begun.concurrencyConflict || begun.alreadyInProgress) {
      // CAS loser / concurrent IN_PROGRESS — wait/re-read resource; never null customerId.
      const resolved = await resolveCustomerAfterConcurrencySkip(
        prisma,
        step,
        conversion.id
      );
      if (resolved.ok && resolved.customerId) {
        customerId = resolved.customerId;
        flags.customerLinked = resolved.action === 'LINK';
        flags.customerCreated = resolved.action === 'CREATE';
      } else {
        blocked = true;
        blockError = begun.error || resolved.error || 'step_concurrency_conflict';
      }
    } else if (!begun.skip && step) {
      try {
        const match = await matchPlatformCustomer(prisma, {
          accountId: request.accountId || plan.accountId,
          evidence: {
            displayName: plan.customerDisplayName || plan.tenantName || null,
            registrationNumber: plan.registrationNumber || null,
            taxId: plan.taxId || null,
            domain: plan.domain || null,
            existingCustomerId: plan.existingCustomerId || null,
          },
        });

        const inferredAction =
          match.matchState === CRM_CUSTOMER_MATCH_STATE.NO_MATCH ? 'CREATE' : 'LINK';
        const decision = await decideCustomerCreateOrLink(prisma, {
          conversionId: conversion.id,
          match,
          admin,
          action: plan.customerAction || inferredAction,
          now,
        });

        const provision = await createOrLinkPlatformCustomer(prisma, {
          conversionId: conversion.id,
          accountId: request.accountId,
          match,
          decision,
          admin,
          idempotencyKey: `customer:${conversion.id}`,
          now,
        });

        if (!provision.ok) {
          const review =
            provision.requiresReview ||
            provision.error === 'possible_match_blocks_create';
          const notAvail = provision.status === 'NOT_AVAILABLE';
          await completeStep(prisma, {
            conversion,
            step: begun.step,
            inputHash,
            admin,
            now,
            outputJson: { match, decision, provision },
            status: review
              ? CRM_CONVERSION_STEP_STATUS.MANUAL_INTERVENTION_REQUIRED
              : notAvail
                ? CRM_CONVERSION_STEP_STATUS.COMPLETED_WITH_WARNING
                : CRM_CONVERSION_STEP_STATUS.FAILED_NON_RETRYABLE,
            errorCode: provision.error || 'customer_provision_failed',
            retryable: false,
          });
          // NOT_AVAILABLE is honest non-fabricated outcome — do not hard-block saga.
          if (review) {
            blocked = true;
            blockError = provision.error;
          } else if (!notAvail) {
            blocked = true;
            blockError = provision.error;
          }
        } else {
          customerId = provision.customerId;
          flags.customerCreated = Boolean(provision.customerCreated);
          flags.customerLinked = Boolean(
            provision.customerLinked || provision.action === 'LINK'
          );
          await completeStep(prisma, {
            conversion,
            step: begun.step,
            inputHash,
            admin,
            now,
            outputJson: { match, decision, provision },
          });
        }
      } catch (err) {
        // Fail closed — never soft-continue to Tenant without Customer.
        await completeStep(prisma, {
          conversion,
          step: begun.step,
          inputHash,
          admin,
          now,
          outputJson: { error: err?.message || 'customer_step_exception' },
          status: CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE,
          errorCode: 'customer_step_exception',
          retryable: true,
        });
        blocked = true;
        blockError = 'customer_step_exception';
      }
    } else if (step?.outputJson?.provision?.customerId) {
      customerId = step.outputJson.provision.customerId;
      flags.customerLinked = step.outputJson.provision.action === 'LINK';
      flags.customerCreated = step.outputJson.provision.action === 'CREATE';
    }
  }

  if (blocked) {
    steps = await loadSteps(prisma, conversion.id);
    return {
      ok: false,
      error: blockError || 'wave2_blocked',
      blocked: true,
      conversion,
      steps,
      customerId,
      ...flags,
    };
  }

  // --- Tenant ---
  {
    steps = await loadSteps(prisma, conversion.id);
    const step = findStep(steps, CRM_CONVERSION_STEP_CODE.CREATE_OR_LINK_TENANT);
    const begun = await beginStep(prisma, step, now);
    if (!begun.skip && step) {
      try {
        const slug =
          plan.tenantSlug ||
          normalizeFallbackSlug(plan.tenantName || request.accountId || conversion.id);
        const tenantDecision = await decideTenantCreateOrLink(prisma, {
          conversionId: conversion.id,
          slug,
          existingTenantId: plan.existingTenantId || null,
          admin,
          action: plan.existingTenantId ? 'LINK' : 'CREATE',
          now,
        });

        const provision = await createOrLinkTenant(prisma, {
          conversionId: conversion.id,
          customerId,
          slug,
          name: plan.tenantName || slug,
          existingTenantId: plan.existingTenantId || null,
          decision: tenantDecision,
          admin,
          idempotencyKey: `tenant:${conversion.id}:${slug}`,
          initFinancialDefaults: args.initFinancialDefaults !== false,
          seedRoles: args.seedRoles !== false,
          now,
        });

        if (!provision.ok) {
          if (provision.tenantId) tenantId = provision.tenantId;
          const notAvail =
            provision.status === 'NOT_AVAILABLE' ||
            provision.error === 'tenant_model_unavailable';
          const failedRetryable =
            provision.status === 'FAILED' ||
            provision.status === 'FAILED_PROVISIONING' ||
            provision.retryable === true ||
            provision.error === 'tenant_accounting_side_effect_detected';
          await completeStep(prisma, {
            conversion,
            step: begun.step,
            inputHash,
            admin,
            now,
            outputJson: { tenantDecision, provision },
            status: notAvail
              ? CRM_CONVERSION_STEP_STATUS.COMPLETED_WITH_WARNING
              : failedRetryable
                ? CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE
                : CRM_CONVERSION_STEP_STATUS.FAILED_NON_RETRYABLE,
            errorCode: provision.error || 'tenant_provision_failed',
            retryable: Boolean(failedRetryable),
          });
          if (!notAvail) {
            blocked = true;
            blockError = provision.error;
          }
        } else {
          tenantId = provision.tenantId;
          flags.tenantCreated = Boolean(provision.tenantCreated);
          flags.tenantLinked = Boolean(provision.tenantLinked);
          if (tenantId) {
            const boundary = await assertNoTenantAccountingSideEffects(prisma, {
              tenantId,
              conversionId: conversion.id,
            });
            if (!boundary.ok) {
              await completeStep(prisma, {
                conversion,
                step: begun.step,
                inputHash,
                admin,
                now,
                outputJson: { provision, accountingBoundary: boundary },
                status: CRM_CONVERSION_STEP_STATUS.FAILED_NON_RETRYABLE,
                errorCode: boundary.error,
              });
              blocked = true;
              blockError = boundary.error;
            } else {
              await completeStep(prisma, {
                conversion,
                step: begun.step,
                inputHash,
                admin,
                now,
                outputJson: {
                  tenantDecision,
                  provision,
                  accountingBoundary: boundary,
                },
              });
            }
          } else {
            await completeStep(prisma, {
              conversion,
              step: begun.step,
              inputHash,
              admin,
              now,
              outputJson: { tenantDecision, provision },
            });
          }
        }
      } catch (err) {
        // Fail closed — do not soft-complete and continue dependents.
        await completeStep(prisma, {
          conversion,
          step: begun.step,
          inputHash,
          admin,
          now,
          outputJson: { error: err?.message || 'tenant_step_exception' },
          status: CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE,
          errorCode: 'tenant_step_exception',
          retryable: true,
        });
        blocked = true;
        blockError = 'tenant_step_exception';
      }
    } else if (step?.outputJson?.provision?.tenantId) {
      tenantId = step.outputJson.provision.tenantId;
      flags.tenantCreated = step.outputJson.provision.action === 'CREATE';
      flags.tenantLinked = step.outputJson.provision.action === 'LINK';
    }
  }

  if (blocked) {
    steps = await loadSteps(prisma, conversion.id);
    return {
      ok: false,
      error: blockError,
      blocked: true,
      conversion,
      steps,
      customerId,
      tenantId,
      ...flags,
    };
  }

  if (!tenantId) {
    // Tenant unavailable (model gap / NOT_AVAILABLE) — skip dependent steps honestly.
    steps = await loadSteps(prisma, conversion.id);
    for (const code of [
      CRM_CONVERSION_STEP_CODE.CREATE_BUSINESS,
      CRM_CONVERSION_STEP_CODE.CREATE_BRANCH,
      CRM_CONVERSION_STEP_CODE.LINK_CONTACTS,
      CRM_CONVERSION_STEP_CODE.CREATE_INITIAL_USER_INVITATIONS,
    ]) {
      const step = findStep(steps, code);
      if (step && !isStepCompleted(step.status)) {
        await markStepStatus(prisma, step.id, {
          status: CRM_CONVERSION_STEP_STATUS.SKIPPED_NOT_APPLICABLE,
          errorCode: 'tenant_unavailable',
          outputJson: { reason: 'tenant_unavailable' },
          updatedAt: now,
        });
      }
    }
    steps = await loadSteps(prisma, conversion.id);
    return {
      ok: true,
      conversion,
      steps,
      customerId,
      tenantId: null,
      ...flags,
    };
  }

  // --- Business / Branch ---
  {
    steps = await loadSteps(prisma, conversion.id);
    const bizStep = findStep(steps, CRM_CONVERSION_STEP_CODE.CREATE_BUSINESS);
    const branchStep = findStep(steps, CRM_CONVERSION_STEP_CODE.CREATE_BRANCH);
    const requireBusiness = plan.requireBusiness === true;
    const requireBranch = plan.requireBranch !== false;

    const begunBiz = await beginStep(prisma, bizStep, now);
    if (!begunBiz.skip && bizStep) {
      const result = await createPrimaryBusinessBranch(prisma, {
        conversionId: conversion.id,
        lockedTenantId: tenantId,
        tenantId,
        businessName: plan.businessName || plan.tenantName || 'Primary Business',
        branchName: plan.branchName || 'Headquarters',
        requireBusiness,
        requireBranch,
        admin,
        idempotencyKey: `bizbranch:${conversion.id}`,
        now,
      });
      if (!result.ok) {
        await completeStep(prisma, {
          conversion,
          step: begunBiz.step,
          inputHash,
          admin,
          now,
          outputJson: result,
          status:
            result.status === 'NOT_AVAILABLE'
              ? CRM_CONVERSION_STEP_STATUS.COMPLETED_WITH_WARNING
              : CRM_CONVERSION_STEP_STATUS.FAILED_NON_RETRYABLE,
          errorCode: result.error,
        });
        if (result.error === 'cross_tenant_denied') {
          blocked = true;
          blockError = result.error;
        }
      } else {
        flags.businessCreated = Boolean(
          result.ok &&
            result.businessId &&
            !result.skippedBusiness &&
            result.status !== 'NOT_AVAILABLE' &&
            !String(result.businessId).startsWith('biz-proxy:')
        );
        flags.branchCreated = Boolean(result.branchId);
        await completeStep(prisma, {
          conversion,
          step: begunBiz.step,
          inputHash,
          admin,
          now,
          outputJson: result,
          status: result.skippedBusiness
            ? CRM_CONVERSION_STEP_STATUS.SKIPPED_NOT_APPLICABLE
            : CRM_CONVERSION_STEP_STATUS.COMPLETED,
        });
        if (branchStep && !isStepCompleted(branchStep.status)) {
          await beginStep(prisma, branchStep, now);
          await completeStep(prisma, {
            conversion,
            step: { ...branchStep, attemptCount: (branchStep.attemptCount || 0) + 1 },
            inputHash,
            admin,
            now,
            outputJson: { branchId: result.branchId },
            status: result.branchId
              ? CRM_CONVERSION_STEP_STATUS.COMPLETED
              : CRM_CONVERSION_STEP_STATUS.SKIPPED_NOT_APPLICABLE,
          });
        }
      }
    }
  }

  if (blocked) {
    steps = await loadSteps(prisma, conversion.id);
    return {
      ok: false,
      error: blockError,
      blocked: true,
      conversion,
      steps,
      customerId,
      tenantId,
      ...flags,
    };
  }

  // --- Link contacts ---
  {
    steps = await loadSteps(prisma, conversion.id);
    const step = findStep(steps, CRM_CONVERSION_STEP_CODE.LINK_CONTACTS);
    const begun = await beginStep(prisma, step, now);
    if (!begun.skip && step) {
      const linked = await linkContactsForConversion(prisma, {
        conversionId: conversion.id,
        tenantId,
        customerId,
        accountId: request.accountId,
        contactId: request.contactId,
        admin,
        now,
      });
      await completeStep(prisma, {
        conversion,
        step: begun.step,
        inputHash,
        admin,
        now,
        outputJson: linked,
        status: linked.ok
          ? CRM_CONVERSION_STEP_STATUS.COMPLETED
          : CRM_CONVERSION_STEP_STATUS.COMPLETED_WITH_WARNING,
        errorCode: linked.ok ? null : linked.error,
      });
    }
  }

  // --- Invitations ---
  {
    steps = await loadSteps(prisma, conversion.id);
    const step = findStep(
      steps,
      CRM_CONVERSION_STEP_CODE.CREATE_INITIAL_USER_INVITATIONS
    );
    const begun = await beginStep(prisma, step, now);
    if (!begun.skip && step) {
      const inviteContacts = plan.inviteContacts !== false;
      if (!inviteContacts || !request.contactId) {
        await completeStep(prisma, {
          conversion,
          step: begun.step,
          inputHash,
          admin,
          now,
          outputJson: { skipped: true, reason: 'no_invite_targets' },
          status: CRM_CONVERSION_STEP_STATUS.SKIPPED_NOT_APPLICABLE,
        });
      } else {
        let contactEmail = plan.inviteEmail || null;
        if (!contactEmail && typeof prisma?.crmContact?.findUnique === 'function') {
          const c = await prisma.crmContact.findUnique({
            where: { id: request.contactId },
          });
          contactEmail = c?.email || null;
        }
        if (!contactEmail) {
          await completeStep(prisma, {
            conversion,
            step: begun.step,
            inputHash,
            admin,
            now,
            outputJson: { skipped: true, reason: 'contact_email_missing' },
            status: CRM_CONVERSION_STEP_STATUS.COMPLETED_WITH_WARNING,
            errorCode: 'contact_email_missing',
          });
        } else {
          const invite = await createInitialUserInvitation(prisma, {
            conversionId: conversion.id,
            tenantId,
            contactId: request.contactId,
            email: contactEmail,
            admin,
            idempotencyKey: `invite:${conversion.id}:${request.contactId}`,
            now,
          });
          if (invite.ok) flags.invitationsCreated = 1;
          await completeStep(prisma, {
            conversion,
            step: begun.step,
            inputHash,
            admin,
            now,
            outputJson: {
              invitationId: invite.invitationId,
              tokenHash: invite.tokenHash,
              idempotentReplay: invite.idempotentReplay,
              status: invite.status,
              error: invite.error || null,
            },
            status: invite.ok
              ? CRM_CONVERSION_STEP_STATUS.COMPLETED
              : invite.status === 'NOT_AVAILABLE'
                ? CRM_CONVERSION_STEP_STATUS.COMPLETED_WITH_WARNING
                : CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE,
            errorCode: invite.ok ? null : invite.error,
            retryable: !invite.ok && invite.status !== 'NOT_AVAILABLE',
          });
        }
      }
    }
  }

  steps = await loadSteps(prisma, conversion.id);
  return {
    ok: true,
    conversion,
    steps,
    customerId,
    tenantId,
    ...flags,
  };
}

function normalizeFallbackSlug(value) {
  return String(value || 'tenant')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 48) || 'tenant';
}

