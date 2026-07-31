/**
 * Wave 3 provision spine — Subscription / Entitlements / Billing / Payment / Activation.
 * Runs after Wave 2. Closed Won ≠ ACTIVE. Invoice from accepted snapshot only.
 */

import {
  CRM_ACTIVATION_POLICY,
  CRM_CONVERSION_STATUS,
  CRM_CONVERSION_STEP_CODE,
  CRM_CONVERSION_STEP_STATUS,
} from './catalogue.js';
import { activateProvisionedSubscription } from './activation.js';
import {
  createBillingSchedule,
  createOrLinkBillingAccount,
  createPlatformInvoiceIfRequired,
} from './billing.js';
import { provisionEntitlementsFromAccepted } from './entitlements.js';
import { initiatePaymentIfRequired } from './paymentBoundary.js';
import { createOrAmendSubscriptionFromAccepted } from './subscription.js';
import {
  getLockedConversionCommercialSnapshot,
} from './commercialSnapshot.js';
import {
  beginStepOptimistic,
  ensureWave3Steps,
  isStepCompleted,
  markStepStatus,
  recordStepAttempt,
} from './steps.js';

const WAVE3_ACTIVE_STEP_CODES_LIST = [
  CRM_CONVERSION_STEP_CODE.CREATE_OR_AMEND_SUBSCRIPTION,
  CRM_CONVERSION_STEP_CODE.PROVISION_ENTITLEMENTS,
  CRM_CONVERSION_STEP_CODE.CREATE_OR_LINK_BILLING_ACCOUNT,
  CRM_CONVERSION_STEP_CODE.CREATE_PLATFORM_INVOICE_IF_REQUIRED,
  CRM_CONVERSION_STEP_CODE.INITIATE_PAYMENT_IF_REQUIRED,
  CRM_CONVERSION_STEP_CODE.ACTIVATE_SUBSCRIPTION,
];

function findStep(steps, stepCode) {
  return steps.find((s) => s.stepCode === stepCode) || null;
}

/** Early partial-fail exits — always label conversionStatus for direct callers. */
function wave3BlockedResult({
  blockError,
  conversion,
  steps,
  tenantId,
  customerId,
  subscriptionId = null,
  billingAccountId,
  invoiceId,
  flags = {},
  conversionStatus = CRM_CONVERSION_STATUS.PARTIALLY_COMPLETED,
}) {
  return {
    ok: false,
    error: blockError || 'wave3_blocked',
    blocked: true,
    conversionStatus,
    conversion,
    steps,
    tenantId,
    customerId,
    subscriptionId,
    ...(billingAccountId !== undefined ? { billingAccountId } : {}),
    ...(invoiceId !== undefined ? { invoiceId } : {}),
    ...flags,
  };
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

function resolveAcceptedSnapshot(plan, args, request, lockedSnapshot = null) {
  if (lockedSnapshot && typeof lockedSnapshot === 'object') {
    return lockedSnapshot;
  }
  return (
    args.acceptedSnapshot ||
    plan.acceptedSnapshot ||
    plan.pricingSnapshot ||
    null
  );
}

/**
 * Execute Wave 3 steps after Wave 2 provision.
 */
export async function runWave3ProvisionSpine(prisma, {
  conversion,
  request,
  admin,
  planVersion = null,
  inputHash,
  now,
  args = {},
  tenantId: priorTenantId = null,
  customerId: priorCustomerId = null,
}) {
  await ensureWave3Steps(prisma, conversion.id, inputHash || conversion.inputHash, now);
  let steps = await loadSteps(prisma, conversion.id);
  const plan = planContent(planVersion);
  let lockedSnapshot = null;
  try {
    const locked = await getLockedConversionCommercialSnapshot(prisma, {
      conversionId: conversion.id,
    });
    if (locked.ok) lockedSnapshot = locked.snapshot;
  } catch {
    lockedSnapshot = null;
  }
  const snapshot = resolveAcceptedSnapshot(plan, args, request, lockedSnapshot);

  const flags = {
    subscriptionCreated: false,
    subscriptionAmended: false,
    subscriptionActive: false,
    entitlementsProvisioned: false,
    invoiceCreated: false,
    invoicePaid: false,
    paymentInitiated: false,
    billingAccountCreated: false,
  };

  let subscriptionId = null;
  let entitlementIds = [];
  let billingAccountId = null;
  let invoiceId = null;
  let tenantId = priorTenantId;
  let customerId = priorCustomerId;
  let blocked = false;
  let blockError = null;

  // Resolve tenant/customer from prior resources if missing
  if (!tenantId && typeof prisma?.crmConversionResource?.findFirst === 'function') {
    const tenRes = await prisma.crmConversionResource.findFirst({
      where: { conversionId: conversion.id, resourceType: 'TENANT' },
    });
    tenantId = tenRes?.resourceId || null;
  }
  if (!customerId && typeof prisma?.crmConversionResource?.findFirst === 'function') {
    const custRes = await prisma.crmConversionResource.findFirst({
      where: { conversionId: conversion.id, resourceType: 'PLATFORM_CUSTOMER' },
    });
    customerId = custRes?.resourceId || null;
  }

  if (!snapshot) {
    // No accepted snapshot → skip Wave 3 honestly (do not fabricate).
    for (const code of WAVE3_ACTIVE_STEP_CODES_LIST) {
      const step = findStep(steps, code);
      if (step && !isStepCompleted(step.status)) {
        await markStepStatus(prisma, step.id, {
          status: CRM_CONVERSION_STEP_STATUS.SKIPPED_NOT_APPLICABLE,
          errorCode: 'accepted_snapshot_required',
          outputJson: {
            skipped: true,
            reason: 'accepted_snapshot_required',
          },
          updatedAt: now,
        });
      }
    }
    steps = await loadSteps(prisma, conversion.id);
    return {
      ok: true,
      skipped: true,
      error: null,
      blocked: false,
      conversion,
      steps,
      tenantId,
      customerId,
      ...flags,
    };
  }

  // --- Subscription ---
  {
    const step = findStep(
      steps,
      CRM_CONVERSION_STEP_CODE.CREATE_OR_AMEND_SUBSCRIPTION
    );
    const begun = await beginStep(prisma, step, now);
    if (!begun.skip && step) {
      try {
        const result = await createOrAmendSubscriptionFromAccepted(prisma, {
          conversionId: conversion.id,
          tenantId,
          customerId,
          conversionType: plan.conversionType || request.conversionType,
          existingSubscriptionId: plan.existingSubscriptionId || null,
          acceptedSnapshot: snapshot,
          admin,
          idempotencyKey: `sub:${conversion.id}`,
          now,
        });
        if (!result.ok) {
          const notAvail = result.status === 'NOT_AVAILABLE';
          await completeStep(prisma, {
            conversion,
            step: begun.step,
            inputHash,
            admin,
            now,
            outputJson: { result },
            status: notAvail
              ? CRM_CONVERSION_STEP_STATUS.COMPLETED_WITH_WARNING
              : CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE,
            errorCode: result.error || 'subscription_provision_failed',
            retryable: !notAvail,
          });
          if (!notAvail) {
            blocked = true;
            blockError = result.error;
          }
        } else {
          subscriptionId = result.subscriptionId;
          flags.subscriptionCreated = Boolean(result.subscriptionCreated);
          flags.subscriptionAmended = Boolean(result.subscriptionAmended);
          flags.subscriptionActive = Boolean(result.isActive);
          await completeStep(prisma, {
            conversion,
            step: begun.step,
            inputHash,
            admin,
            now,
            outputJson: { result },
          });
        }
      } catch (err) {
        await completeStep(prisma, {
          conversion,
          step: begun.step,
          inputHash,
          admin,
          now,
          outputJson: { error: err?.message || 'subscription_step_exception' },
          status: CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE,
          errorCode: 'subscription_step_exception',
          retryable: true,
        });
        blocked = true;
        blockError = 'subscription_step_exception';
      }
    } else if (step?.outputJson?.result?.subscriptionId) {
      subscriptionId = step.outputJson.result.subscriptionId;
      flags.subscriptionCreated = Boolean(step.outputJson.result.subscriptionCreated);
      flags.subscriptionAmended = Boolean(step.outputJson.result.subscriptionAmended);
    }
  }

  if (blocked) {
    steps = await loadSteps(prisma, conversion.id);
    return wave3BlockedResult({
      blockError,
      conversion,
      steps,
      tenantId,
      customerId,
      subscriptionId,
      flags,
    });
  }

  // --- Entitlements ---
  {
    steps = await loadSteps(prisma, conversion.id);
    const step = findStep(steps, CRM_CONVERSION_STEP_CODE.PROVISION_ENTITLEMENTS);
    if (step && !isStepCompleted(step.status) && !subscriptionId) {
      const begun = await beginStep(prisma, step, now);
      if (!begun.skip) {
        await completeStep(prisma, {
          conversion,
          step: begun.step,
          inputHash,
          admin,
          now,
          outputJson: {
            error: 'subscriptionId_required',
            note: 'Cannot provision entitlements without subscription',
          },
          status: CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE,
          errorCode: 'subscriptionId_required',
          retryable: true,
        });
        blocked = true;
        blockError = 'subscriptionId_required';
      }
    } else {
      const begun = await beginStep(prisma, step, now);
      if (!begun.skip && step && subscriptionId) {
        try {
          const result = await provisionEntitlementsFromAccepted(prisma, {
            conversionId: conversion.id,
            tenantId,
            subscriptionId,
            acceptedSnapshot: snapshot,
            admin,
            idempotencyKey: `ent:${conversion.id}`,
            now,
          });
          if (!result.ok) {
            await completeStep(prisma, {
              conversion,
              step: begun.step,
              inputHash,
              admin,
              now,
              outputJson: { result },
              status:
                result.status === 'NOT_AVAILABLE'
                  ? CRM_CONVERSION_STEP_STATUS.COMPLETED_WITH_WARNING
                  : CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE,
              errorCode: result.error || 'entitlement_provision_failed',
              retryable: result.status !== 'NOT_AVAILABLE',
            });
            if (result.status !== 'NOT_AVAILABLE') {
              blocked = true;
              blockError = result.error;
            }
          } else {
            flags.entitlementsProvisioned = true;
            entitlementIds = Array.isArray(result.entitlementIds)
              ? result.entitlementIds
              : [];
            await completeStep(prisma, {
              conversion,
              step: begun.step,
              inputHash,
              admin,
              now,
              outputJson: { result },
            });
          }
        } catch (err) {
          await completeStep(prisma, {
            conversion,
            step: begun.step,
            inputHash,
            admin,
            now,
            outputJson: { error: err?.message || 'entitlement_step_exception' },
            status: CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE,
            errorCode: 'entitlement_step_exception',
            retryable: true,
          });
          blocked = true;
          blockError = 'entitlement_step_exception';
        }
      } else if (step?.outputJson?.result?.entitlementIds) {
        entitlementIds = step.outputJson.result.entitlementIds;
      }
    }
  }

  if (blocked) {
    steps = await loadSteps(prisma, conversion.id);
    return wave3BlockedResult({
      blockError,
      conversion,
      steps,
      tenantId,
      customerId,
      subscriptionId,
      flags,
    });
  }

  // --- Billing account + schedule ---
  {
    steps = await loadSteps(prisma, conversion.id);
    const step = findStep(
      steps,
      CRM_CONVERSION_STEP_CODE.CREATE_OR_LINK_BILLING_ACCOUNT
    );
    const begun = await beginStep(prisma, step, now);
    if (!begun.skip && step) {
      try {
        const acct = await createOrLinkBillingAccount(prisma, {
          conversionId: conversion.id,
          tenantId,
          customerId,
          currency: snapshot.currency || request.currency || 'MWK',
          admin,
          idempotencyKey: `pba:${conversion.id}`,
          now,
        });
        if (!acct.ok) {
          await completeStep(prisma, {
            conversion,
            step: begun.step,
            inputHash,
            admin,
            now,
            outputJson: { acct },
            status:
              acct.status === 'NOT_AVAILABLE'
                ? CRM_CONVERSION_STEP_STATUS.COMPLETED_WITH_WARNING
                : CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE,
            errorCode: acct.error || 'billing_account_failed',
            retryable: acct.status !== 'NOT_AVAILABLE',
          });
          if (acct.status !== 'NOT_AVAILABLE') {
            blocked = true;
            blockError = acct.error;
          }
        } else {
          billingAccountId = acct.billingAccountId;
          flags.billingAccountCreated = Boolean(acct.billingAccountCreated);
          let schedule = null;
          if (billingAccountId) {
            schedule = await createBillingSchedule(prisma, {
              conversionId: conversion.id,
              billingAccountId,
              subscriptionId,
              acceptedSnapshot: snapshot,
              admin,
              idempotencyKey: `pbs:${conversion.id}`,
              now,
            });
          }
          await completeStep(prisma, {
            conversion,
            step: begun.step,
            inputHash,
            admin,
            now,
            outputJson: { acct, schedule },
            status:
              schedule && schedule.ok === false && schedule.status === 'NOT_AVAILABLE'
                ? CRM_CONVERSION_STEP_STATUS.COMPLETED_WITH_WARNING
                : CRM_CONVERSION_STEP_STATUS.COMPLETED,
          });
        }
      } catch (err) {
        await completeStep(prisma, {
          conversion,
          step: begun.step,
          inputHash,
          admin,
          now,
          outputJson: { error: err?.message || 'billing_step_exception' },
          status: CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE,
          errorCode: 'billing_step_exception',
          retryable: true,
        });
        blocked = true;
        blockError = 'billing_step_exception';
      }
    } else if (step?.outputJson?.acct?.billingAccountId) {
      billingAccountId = step.outputJson.acct.billingAccountId;
    }
  }

  if (blocked) {
    steps = await loadSteps(prisma, conversion.id);
    return wave3BlockedResult({
      blockError,
      conversion,
      steps,
      tenantId,
      customerId,
      subscriptionId,
      billingAccountId,
      flags,
    });
  }

  // --- Platform Invoice ---
  {
    steps = await loadSteps(prisma, conversion.id);
    const step = findStep(
      steps,
      CRM_CONVERSION_STEP_CODE.CREATE_PLATFORM_INVOICE_IF_REQUIRED
    );
    const begun = await beginStep(prisma, step, now);
    if (!begun.skip && step) {
      try {
        const result = await createPlatformInvoiceIfRequired(prisma, {
          conversionId: conversion.id,
          tenantId,
          subscriptionId,
          acceptedSnapshot: snapshot,
          admin,
          idempotencyKey: `pinv:${conversion.id}:${subscriptionId || 'none'}`,
          now,
        });
        if (!result.ok) {
          await completeStep(prisma, {
            conversion,
            step: begun.step,
            inputHash,
            admin,
            now,
            outputJson: { result },
            status:
              result.status === 'NOT_AVAILABLE'
                ? CRM_CONVERSION_STEP_STATUS.COMPLETED_WITH_WARNING
                : CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE,
            errorCode: result.error || 'invoice_create_failed',
            retryable: result.status !== 'NOT_AVAILABLE',
          });
          if (result.status !== 'NOT_AVAILABLE') {
            blocked = true;
            blockError = result.error;
          }
        } else {
          invoiceId = result.invoiceId || null;
          flags.invoiceCreated = Boolean(result.invoiceCreated || result.idempotentReplay);
          flags.invoicePaid = false;
          await completeStep(prisma, {
            conversion,
            step: begun.step,
            inputHash,
            admin,
            now,
            outputJson: { result },
          });
        }
      } catch (err) {
        await completeStep(prisma, {
          conversion,
          step: begun.step,
          inputHash,
          admin,
          now,
          outputJson: { error: err?.message || 'invoice_step_exception' },
          status: CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE,
          errorCode: 'invoice_step_exception',
          retryable: true,
        });
        blocked = true;
        blockError = 'invoice_step_exception';
      }
    } else if (step?.outputJson?.result?.invoiceId) {
      invoiceId = step.outputJson.result.invoiceId;
    }
  }

  if (blocked) {
    steps = await loadSteps(prisma, conversion.id);
    return wave3BlockedResult({
      blockError,
      conversion,
      steps,
      tenantId,
      customerId,
      subscriptionId,
      invoiceId,
      flags,
    });
  }

  // --- Payment initiation ---
  {
    steps = await loadSteps(prisma, conversion.id);
    const step = findStep(
      steps,
      CRM_CONVERSION_STEP_CODE.INITIATE_PAYMENT_IF_REQUIRED
    );
    const begun = await beginStep(prisma, step, now);
    if (!begun.skip && step) {
      try {
        const result = await initiatePaymentIfRequired(prisma, {
          conversionId: conversion.id,
          tenantId,
          invoiceId,
          acceptedSnapshot: snapshot,
          admin,
          idempotencyKey: `ppay:${conversion.id}`,
          paymentProvider: plan.paymentProvider || args.paymentProvider || null,
          now,
        });
        flags.paymentInitiated =
          result.status === 'INITIATED' || result.status === 'PENDING';
        flags.invoicePaid = false;
        await completeStep(prisma, {
          conversion,
          step: begun.step,
          inputHash,
          admin,
          now,
          outputJson: { result },
          status:
            result.ok === false && result.status === 'NOT_AVAILABLE'
              ? CRM_CONVERSION_STEP_STATUS.COMPLETED_WITH_WARNING
              : result.ok === false
                ? CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE
                : CRM_CONVERSION_STEP_STATUS.COMPLETED,
          errorCode: result.ok === false ? result.error : null,
          retryable: result.ok === false && result.status !== 'NOT_AVAILABLE',
        });
      } catch (err) {
        await completeStep(prisma, {
          conversion,
          step: begun.step,
          inputHash,
          admin,
          now,
          outputJson: { error: err?.message || 'payment_step_exception' },
          status: CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE,
          errorCode: 'payment_step_exception',
          retryable: true,
        });
      }
    }
  }

  // --- Activation (policy-gated; Closed Won ≠ ACTIVE) ---
  {
    steps = await loadSteps(prisma, conversion.id);
    const step = findStep(steps, CRM_CONVERSION_STEP_CODE.ACTIVATE_SUBSCRIPTION);
    if (step && !isStepCompleted(step.status) && !subscriptionId) {
      const begun = await beginStep(prisma, step, now);
      if (!begun.skip) {
        await completeStep(prisma, {
          conversion,
          step: begun.step,
          inputHash,
          admin,
          now,
          outputJson: {
            error: 'subscriptionId_required',
            note: 'Cannot activate without subscription',
          },
          status: CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE,
          errorCode: 'subscriptionId_required',
          retryable: true,
        });
        blocked = true;
        blockError = 'subscriptionId_required';
      }
    } else {
      const begun = await beginStep(prisma, step, now);
      if (!begun.skip && step && subscriptionId) {
        const policy =
          plan.activationPolicy ||
          args.activationPolicy ||
          CRM_ACTIVATION_POLICY.AFTER_PAYMENT;
        try {
          const result = await activateProvisionedSubscription(prisma, {
            actorContext: { admin },
            subscriptionId,
            conversionId: conversion.id,
            entitlementIds,
            activationPolicyVersionId: policy,
            evidence: {
              closedWon: true,
              invoiceIssued: Boolean(invoiceId),
              invoiceId,
              // Never claim payment from conversion spine — authoritative Payment rows only
              paymentId: args.paymentId || null,
              manualApproval: Boolean(args.manualActivationApproval),
              serviceDate: plan.serviceDate || args.serviceDate || null,
              now,
            },
            idempotencyKey: `act:${conversion.id}`,
            now,
          });

          if (!result.ok) {
            // Deferred / blocked — keep step re-enterable (not COMPLETED_WITH_WARNING)
            await completeStep(prisma, {
              conversion,
              step: begun.step,
              inputHash,
              admin,
              now,
              outputJson: {
                result,
                note: 'Subscription remains pending; Closed Won ≠ ACTIVE',
              },
              status: CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE,
              errorCode: result.error || 'activation_deferred',
              retryable: true,
            });
            flags.subscriptionActive = false;
          } else {
            flags.subscriptionActive = Boolean(result.activated);
            await completeStep(prisma, {
              conversion,
              step: begun.step,
              inputHash,
              admin,
              now,
              outputJson: { result },
            });
          }
        } catch (err) {
          await completeStep(prisma, {
            conversion,
            step: begun.step,
            inputHash,
            admin,
            now,
            outputJson: { error: err?.message || 'activation_step_exception' },
            status: CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE,
            errorCode: 'activation_step_exception',
            retryable: true,
          });
        }
      }
    }
  }

  steps = await loadSteps(prisma, conversion.id);
  // Partial provider failure / deferred activation → PARTIALLY_COMPLETED (never fabricate COMPLETED).
  return {
    ok: !blocked,
    error: blockError,
    blocked,
    conversionStatus: CRM_CONVERSION_STATUS.PARTIALLY_COMPLETED,
    conversion,
    steps,
    tenantId,
    customerId,
    subscriptionId,
    billingAccountId,
    invoiceId,
    ...flags,
  };
}
