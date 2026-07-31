/**
 * Wave 3 — Payment initiation boundary.
 * Initiation ≠ PAID. Existing provider or NOT_CONFIGURED — never fabricate PAID.
 */

import { createHash } from 'crypto';
import {
  paymentIdempotencyKey,
  isSuccessfulPaymentStatus,
} from '../../platformBilling.js';
import {
  CRM_CONVERSION_RESOURCE_TYPE,
  CRM_PAYMENT_INITIATION_STATUS,
} from './catalogue.js';
import { resolveConversionActor } from './model.js';

function hasPaymentModel(prisma) {
  return typeof prisma?.platformPayment?.create === 'function';
}

function hasResourceModel(prisma) {
  return typeof prisma?.crmConversionResource?.create === 'function';
}

function resolveProvider(args) {
  if (args.paymentProvider) return String(args.paymentProvider).trim();
  if (args.provider) return String(args.provider).trim();
  if (process.env.PLATFORM_PAYMENT_PROVIDER) {
    return String(process.env.PLATFORM_PAYMENT_PROVIDER).trim();
  }
  return null;
}

/**
 * Initiate payment against Platform Invoice when required.
 * Never marks PAID/COMPLETED from conversion alone.
 */
export async function initiatePaymentIfRequired(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const conversionId = args.conversionId ? String(args.conversionId) : null;
  const tenantId = args.tenantId ? String(args.tenantId).trim() : '';
  const invoiceId = args.invoiceId || null;
  const snapshot = args.acceptedSnapshot;
  const now = args.now || new Date();
  const idempotencyKey =
    args.idempotencyKey ||
    (conversionId ? `ppay:${conversionId}` : null);

  if (!tenantId) return { ok: false, error: 'tenantId_required' };
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };

  if (args.skipPayment === true || args.paymentRequired === false) {
    return {
      ok: true,
      skipped: true,
      status: CRM_PAYMENT_INITIATION_STATUS.NOT_REQUIRED,
      paymentStatus: CRM_PAYMENT_INITIATION_STATUS.NOT_REQUIRED,
      fabricatedPaid: false,
    };
  }

  const provider = resolveProvider(args);
  if (!provider) {
    // Honest typed outcome — do not fabricate a PAID payment row.
    if (hasResourceModel(prisma) && conversionId) {
      const existingRes = await prisma.crmConversionResource.findFirst({
        where: {
          conversionId,
          resourceType: CRM_CONVERSION_RESOURCE_TYPE.PLATFORM_PAYMENT,
          idempotencyKey,
        },
      });
      if (existingRes) {
        return {
          ok: true,
          status: CRM_PAYMENT_INITIATION_STATUS.NOT_CONFIGURED,
          paymentStatus: CRM_PAYMENT_INITIATION_STATUS.NOT_CONFIGURED,
          fabricatedPaid: false,
          idempotentReplay: true,
          provider: null,
        };
      }
      await prisma.crmConversionResource.create({
        data: {
          conversionId,
          resourceType: CRM_CONVERSION_RESOURCE_TYPE.PLATFORM_PAYMENT,
          resourceId: `not-configured:${conversionId}`,
          action: 'INITIATE',
          status: CRM_PAYMENT_INITIATION_STATUS.NOT_CONFIGURED,
          idempotencyKey,
          metaJson: {
            invoiceId,
            reason: 'payment_provider_not_configured',
          },
          actorAdminId: admin?.id || null,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    return {
      ok: true,
      status: CRM_PAYMENT_INITIATION_STATUS.NOT_CONFIGURED,
      paymentStatus: CRM_PAYMENT_INITIATION_STATUS.NOT_CONFIGURED,
      fabricatedPaid: false,
      provider: null,
      paymentId: null,
    };
  }

  if (!hasPaymentModel(prisma)) {
    return {
      ok: false,
      error: 'platform_payment_model_unavailable',
      status: 'NOT_AVAILABLE',
      paymentStatus: 'NOT_AVAILABLE',
      fabricatedPaid: false,
    };
  }

  if (!invoiceId) {
    return { ok: false, error: 'invoiceId_required_for_payment_initiation' };
  }

  const existing = await prisma.platformPayment.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    const status = String(existing.status || '').toUpperCase();
    return {
      ok: true,
      paymentId: existing.id,
      status: CRM_PAYMENT_INITIATION_STATUS.INITIATED,
      paymentStatus: status,
      fabricatedPaid: false,
      idempotentReplay: true,
      provider,
      // Honesty: never claim PAID from initiation replay
      isPaid: false,
    };
  }

  const amount =
    args.amount != null
      ? Number(args.amount)
      : Number(snapshot?.totals?.total ?? 0);
  const gatewayReference =
    args.gatewayReference ||
    `cvn-pay:${conversionId || 'none'}:${invoiceId}`;
  const payIdem =
    paymentIdempotencyKey({ gateway: provider, gatewayReference }) ||
    idempotencyKey;

  const paymentNumber =
    args.paymentNumber ||
    `PPAY-CVN-${createHash('sha256').update(payIdem).digest('hex').slice(0, 10).toUpperCase()}`;

  let payment;
  try {
    payment = await prisma.platformPayment.create({
      data: {
        paymentNumber,
        tenantId,
        invoiceId,
        currency: snapshot?.currency || args.currency || 'MWK',
        amount,
        method: args.method || 'GATEWAY',
        gateway: provider,
        gatewayReference,
        status: 'PENDING',
        idempotencyKey: payIdem === idempotencyKey ? idempotencyKey : idempotencyKey,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    const raced = await prisma.platformPayment.findUnique({
      where: { idempotencyKey },
    });
    if (raced) {
      return {
        ok: true,
        paymentId: raced.id,
        status: CRM_PAYMENT_INITIATION_STATUS.INITIATED,
        paymentStatus: raced.status,
        fabricatedPaid: false,
        idempotentReplay: true,
        provider,
        isPaid: false,
      };
    }
    return {
      ok: false,
      error: err?.message || 'payment_initiation_failed',
      status: 'FAILED_RETRYABLE',
      fabricatedPaid: false,
    };
  }

  // Hard honesty: initiation must never look successful/paid
  if (isSuccessfulPaymentStatus(payment.status) || payment.status === 'PAID') {
    return {
      ok: false,
      error: 'fabricated_paid_forbidden',
      fabricatedPaid: true,
    };
  }

  if (hasResourceModel(prisma) && conversionId) {
    await prisma.crmConversionResource.create({
      data: {
        conversionId,
        resourceType: CRM_CONVERSION_RESOURCE_TYPE.PLATFORM_PAYMENT,
        resourceId: payment.id,
        action: 'INITIATE',
        status: payment.status,
        idempotencyKey,
        metaJson: {
          invoiceId,
          provider,
          paymentStatus: payment.status,
          fabricatedPaid: false,
        },
        actorAdminId: admin?.id || null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  return {
    ok: true,
    paymentId: payment.id,
    status: CRM_PAYMENT_INITIATION_STATUS.INITIATED,
    paymentStatus: payment.status,
    fabricatedPaid: false,
    provider,
    isPaid: false,
  };
}
