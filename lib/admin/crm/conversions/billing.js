/**
 * Wave 3 — Platform Billing Account / Schedule / Invoice from accepted snapshot.
 * Idempotent Platform Invoice; never Tenant GL / AR.
 */

import { createHash } from 'crypto';
import {
  invoiceIdempotencyKey,
  reconcileInvoiceLine,
} from '../../platformBilling.js';
import {
  CRM_CONVERSION_RESOURCE_TYPE,
} from './catalogue.js';
import { resolveConversionActor } from './model.js';
import { assertNoTenantAccountingSideEffects } from './accountingBoundary.js';

function hasBillingAccountModel(prisma) {
  return typeof prisma?.platformBillingAccount?.create === 'function';
}

function hasBillingScheduleModel(prisma) {
  return typeof prisma?.platformBillingSchedule?.create === 'function';
}

function hasInvoiceModel(prisma) {
  return typeof prisma?.platformInvoice?.create === 'function';
}

function hasResourceModel(prisma) {
  return typeof prisma?.crmConversionResource?.create === 'function';
}

function snapshotTotals(snapshot) {
  const totals = snapshot?.totals || {};
  const subtotal = Number(totals.subtotal ?? 0);
  const discount = Number(totals.discount ?? 0);
  const tax = Number(totals.tax ?? 0);
  let total = Number(totals.total);
  if (!Number.isFinite(total)) {
    total = Math.round((subtotal - discount + tax) * 100) / 100;
  }
  return { subtotal, discount, tax, total };
}

/**
 * Create or link Platform Billing Account (conversion plane).
 */
export async function createOrLinkBillingAccount(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const conversionId = args.conversionId ? String(args.conversionId) : null;
  const tenantId = args.tenantId ? String(args.tenantId).trim() : '';
  const customerId = args.customerId || null;
  const idempotencyKey =
    args.idempotencyKey ||
    (conversionId ? `pba:${conversionId}` : null);
  const now = args.now || new Date();

  if (!tenantId) return { ok: false, error: 'tenantId_required' };
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };

  if (!hasBillingAccountModel(prisma)) {
    return {
      ok: false,
      error: 'billing_account_model_unavailable',
      status: 'NOT_AVAILABLE',
    };
  }

  const existing = await prisma.platformBillingAccount.findFirst({
    where: { idempotencyKey },
  });
  if (existing) {
    return {
      ok: true,
      billingAccountId: existing.id,
      action: existing.action || 'CREATE',
      idempotentReplay: true,
    };
  }

  if (args.existingBillingAccountId) {
    const linked = await prisma.platformBillingAccount.findUnique?.({
      where: { id: args.existingBillingAccountId },
    });
    if (!linked) {
      return { ok: false, error: 'billing_account_not_found', status: 'NOT_AVAILABLE' };
    }
    return {
      ok: true,
      billingAccountId: linked.id,
      action: 'LINK',
      billingAccountLinked: true,
    };
  }

  const created = await prisma.platformBillingAccount.create({
    data: {
      tenantId,
      customerId,
      currency: args.currency || 'MWK',
      status: 'ACTIVE',
      action: 'CREATE',
      idempotencyKey,
      metaJson: { conversionId },
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  if (hasResourceModel(prisma) && conversionId) {
    await prisma.crmConversionResource.create({
      data: {
        conversionId,
        resourceType: CRM_CONVERSION_RESOURCE_TYPE.BILLING_ACCOUNT,
        resourceId: created.id,
        action: 'CREATE',
        status: 'ACTIVE',
        idempotencyKey,
        metaJson: { tenantId, customerId },
        actorAdminId: admin?.id || null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  return {
    ok: true,
    billingAccountId: created.id,
    action: 'CREATE',
    billingAccountCreated: true,
  };
}

/**
 * Create billing schedule bound to subscription + accepted period.
 */
export async function createBillingSchedule(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const conversionId = args.conversionId ? String(args.conversionId) : null;
  const billingAccountId = args.billingAccountId
    ? String(args.billingAccountId)
    : '';
  const subscriptionId = args.subscriptionId || null;
  const snapshot = args.acceptedSnapshot;
  const idempotencyKey =
    args.idempotencyKey ||
    (conversionId ? `pbs:${conversionId}` : null);
  const now = args.now || new Date();

  if (!billingAccountId) return { ok: false, error: 'billingAccountId_required' };
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };

  if (!hasBillingScheduleModel(prisma)) {
    return {
      ok: false,
      error: 'billing_schedule_model_unavailable',
      status: 'NOT_AVAILABLE',
    };
  }

  const existing = await prisma.platformBillingSchedule.findFirst({
    where: { idempotencyKey },
  });
  if (existing) {
    return {
      ok: true,
      scheduleId: existing.id,
      idempotentReplay: true,
    };
  }

  const created = await prisma.platformBillingSchedule.create({
    data: {
      billingAccountId,
      subscriptionId,
      cycle: args.cycle || 'month',
      periodStart: snapshot?.periodStart ? new Date(snapshot.periodStart) : null,
      periodEnd: snapshot?.periodEnd ? new Date(snapshot.periodEnd) : null,
      status: 'SCHEDULED',
      idempotencyKey,
      metaJson: {
        conversionId,
        acceptanceId: snapshot?.acceptanceId || null,
        source: 'ACCEPTED_SNAPSHOT',
      },
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  if (hasResourceModel(prisma) && conversionId) {
    await prisma.crmConversionResource.create({
      data: {
        conversionId,
        resourceType: CRM_CONVERSION_RESOURCE_TYPE.BILLING_SCHEDULE,
        resourceId: created.id,
        action: 'CREATE',
        status: 'SCHEDULED',
        idempotencyKey,
        metaJson: { billingAccountId, subscriptionId },
        actorAdminId: admin?.id || null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  return {
    ok: true,
    scheduleId: created.id,
    scheduleCreated: true,
  };
}

/**
 * Create Platform Invoice from accepted snapshot only (not live Price Book).
 * Exact idempotencyKey retry → same invoice. amountPaid stays 0.
 */
export async function createPlatformInvoiceIfRequired(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const conversionId = args.conversionId ? String(args.conversionId) : null;
  const tenantId = args.tenantId ? String(args.tenantId).trim() : '';
  const subscriptionId = args.subscriptionId || null;
  const snapshot = args.acceptedSnapshot;
  const now = args.now || new Date();

  if (!tenantId) return { ok: false, error: 'tenantId_required' };
  if (!snapshot || typeof snapshot !== 'object') {
    return { ok: false, error: 'accepted_snapshot_required' };
  }

  if (args.skipInvoice === true || args.invoiceRequired === false) {
    return {
      ok: true,
      skipped: true,
      invoiceCreated: false,
      reason: 'invoice_not_required',
    };
  }

  if (!hasInvoiceModel(prisma)) {
    return {
      ok: false,
      error: 'platform_invoice_model_unavailable',
      status: 'NOT_AVAILABLE',
      invoiceCreated: false,
    };
  }

  const { subtotal, discount, tax, total } = snapshotTotals(snapshot);
  const lineCheck = reconcileInvoiceLine({ subtotal, discount, tax, total });
  if (!lineCheck.ok) {
    return {
      ok: false,
      error: 'accepted_snapshot_line_math_invalid',
      reconciliation: lineCheck,
    };
  }

  const periodStart = snapshot.periodStart
    ? new Date(snapshot.periodStart)
    : null;
  const periodEnd = snapshot.periodEnd ? new Date(snapshot.periodEnd) : null;

  const idempotencyKey =
    args.idempotencyKey ||
    invoiceIdempotencyKey({
      tenantId,
      subscriptionId: subscriptionId || conversionId || 'none',
      periodStart: periodStart ? periodStart.toISOString() : 'none',
      periodEnd: periodEnd ? periodEnd.toISOString() : 'none',
    });

  const existing = await prisma.platformInvoice.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return {
      ok: true,
      invoiceId: existing.id,
      invoiceNumber: existing.invoiceNumber,
      status: existing.status,
      total: Number(existing.total),
      amountPaid: Number(existing.amountPaid || 0),
      outstanding: Number(existing.outstanding ?? existing.total),
      source: 'ACCEPTED_SNAPSHOT',
      idempotentReplay: true,
      invoiceCreated: false,
    };
  }

  const invoiceNumber =
    args.invoiceNumber ||
    `PINV-CVN-${createHash('sha256')
      .update(idempotencyKey)
      .digest('hex')
      .slice(0, 10)
      .toUpperCase()}`;

  let invoice;
  try {
    invoice = await prisma.platformInvoice.create({
      data: {
        invoiceNumber,
        tenantId,
        subscriptionId,
        periodStart,
        periodEnd,
        currency: snapshot.currency || 'MWK',
        subtotal,
        discount,
        tax,
        total,
        amountPaid: 0,
        outstanding: total,
        status: 'ISSUED',
        idempotencyKey,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      const raced = await prisma.platformInvoice.findUnique({
        where: { idempotencyKey },
      });
      if (raced) {
        return {
          ok: true,
          invoiceId: raced.id,
          invoiceNumber: raced.invoiceNumber,
          status: raced.status,
          total: Number(raced.total),
          amountPaid: Number(raced.amountPaid || 0),
          source: 'ACCEPTED_SNAPSHOT',
          idempotentReplay: true,
          invoiceCreated: false,
        };
      }
    }
    return {
      ok: false,
      error: err?.message || 'platform_invoice_create_failed',
      status: 'FAILED_RETRYABLE',
    };
  }

  // Honesty: Platform Invoice must never post Tenant GL
  const boundary = await assertNoTenantAccountingSideEffects(prisma, {
    tenantId,
    conversionId,
  });
  if (!boundary.ok) {
    return {
      ok: false,
      error: boundary.error || 'tenant_accounting_side_effect_detected',
      invoiceId: invoice.id,
      retryable: true,
      invoiceCreated: true,
    };
  }

  if (hasResourceModel(prisma) && conversionId) {
    await prisma.crmConversionResource.create({
      data: {
        conversionId,
        resourceType: CRM_CONVERSION_RESOURCE_TYPE.PLATFORM_INVOICE,
        resourceId: invoice.id,
        action: 'CREATE',
        status: invoice.status,
        idempotencyKey,
        metaJson: {
          tenantId,
          subscriptionId,
          acceptanceId: snapshot.acceptanceId || null,
          checksumSha256: snapshot.checksumSha256 || null,
          source: 'ACCEPTED_SNAPSHOT',
          total,
          amountPaid: 0,
          actorAdminId: admin?.id || null,
        },
        actorAdminId: admin?.id || null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  return {
    ok: true,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    total,
    amountPaid: 0,
    outstanding: total,
    source: 'ACCEPTED_SNAPSHOT',
    invoiceCreated: true,
    fabricatedPaid: false,
  };
}
