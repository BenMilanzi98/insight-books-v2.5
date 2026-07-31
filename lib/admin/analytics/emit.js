/**
 * Safe emit helpers for operational writers (never throws into caller critical path).
 */

import { appendAnalyticsOutbox } from './outbox.js';
import { ANALYTICS_EVENT_TYPES } from './catalogue.js';

async function safeAppend(db, input) {
  try {
    if (!db || typeof db.analyticsOutbox?.create !== 'function') {
      return { ok: false, skipped: true, reason: 'analytics_unavailable' };
    }
    return await appendAnalyticsOutbox(db, input);
  } catch (e) {
    console.warn('[analytics.emit]', e?.message || e);
    return { ok: false, error: e?.message || 'emit failed' };
  }
}

export async function emitTenantCreated(db, { tenant, actorId = null, correlationId = null }) {
  if (!tenant?.id) return { ok: false, error: 'tenant required' };
  return safeAppend(db, {
    tenantId: tenant.id,
    aggregateType: 'Tenant',
    aggregateId: tenant.id,
    eventType: ANALYTICS_EVENT_TYPES.TENANT_CREATED,
    idempotencyKey: `evt:TENANT_CREATED:${tenant.id}`,
    actorType: 'admin',
    actorId,
    correlationId,
    payload: { name: tenant.name, status: tenant.status, subdomain: tenant.subdomain },
    occurredAt: tenant.createdAt || new Date(),
  });
}

export async function emitTenantStatusChanged(db, { tenantId, fromStatus, toStatus, actorId = null }) {
  return safeAppend(db, {
    tenantId,
    aggregateType: 'Tenant',
    aggregateId: tenantId,
    eventType: ANALYTICS_EVENT_TYPES.TENANT_STATUS_CHANGED,
    idempotencyKey: `evt:TENANT_STATUS_CHANGED:${tenantId}:${toStatus}:${Date.now()}`,
    actorType: 'admin',
    actorId,
    payload: { fromStatus, toStatus },
  });
}

export async function emitSubscriptionStarted(db, { subscription, renewed = false }) {
  if (!subscription?.id || !subscription?.tenantId) {
    return { ok: false, error: 'subscription required' };
  }
  const eventType = renewed
    ? ANALYTICS_EVENT_TYPES.SUBSCRIPTION_RENEWED
    : ANALYTICS_EVENT_TYPES.SUBSCRIPTION_STARTED;
  return safeAppend(db, {
    tenantId: subscription.tenantId,
    aggregateType: 'AccountSubscription',
    aggregateId: subscription.id,
    eventType,
    idempotencyKey: `evt:${eventType}:${subscription.id}:${subscription.txRef || subscription.id}`,
    payload: {
      planCode: subscription.plan,
      amount: subscription.amount,
      currency: subscription.currency,
      status: subscription.status,
      txRef: subscription.txRef,
    },
    occurredAt: subscription.startedAt || subscription.paymentDate || new Date(),
  });
}

export async function emitPlatformLedgerEvents(db, { invoice, payment, createdInvoice, createdPayment }) {
  const results = [];
  if (invoice?.id && createdInvoice) {
    results.push(
      await safeAppend(db, {
        tenantId: invoice.tenantId,
        aggregateType: 'PlatformInvoice',
        aggregateId: invoice.id,
        eventType: ANALYTICS_EVENT_TYPES.PLATFORM_INVOICE_ISSUED,
        idempotencyKey: `evt:PLATFORM_INVOICE_ISSUED:${invoice.id}`,
        payload: {
          total: Number(invoice.total),
          currency: invoice.currency,
          status: invoice.status,
          subscriptionId: invoice.subscriptionId,
        },
        occurredAt: invoice.createdAt || new Date(),
      })
    );
  }
  if (payment?.id && (createdPayment || payment.status === 'COMPLETED')) {
    results.push(
      await safeAppend(db, {
        tenantId: payment.tenantId,
        aggregateType: 'PlatformPayment',
        aggregateId: payment.id,
        eventType: ANALYTICS_EVENT_TYPES.PLATFORM_PAYMENT_SUCCEEDED,
        idempotencyKey: `evt:PLATFORM_PAYMENT_SUCCEEDED:${payment.id}`,
        payload: {
          amount: Number(payment.amount),
          currency: payment.currency,
          invoiceId: payment.invoiceId,
          gateway: payment.gateway,
        },
        occurredAt: payment.createdAt || new Date(),
      })
    );
  }
  return { ok: results.every((r) => r.ok !== false), results };
}

export async function emitAdminLogin(db, { adminId, email = null }) {
  return safeAppend(db, {
    tenantId: null,
    aggregateType: 'Admin',
    aggregateId: adminId,
    eventType: ANALYTICS_EVENT_TYPES.ADMIN_LOGIN,
    idempotencyKey: `evt:ADMIN_LOGIN:${adminId}:${new Date().toISOString().slice(0, 13)}`,
    actorType: 'admin',
    actorId: adminId,
    payload: { email },
  });
}

export async function emitUserLogin(db, { userId, tenantId }) {
  return safeAppend(db, {
    tenantId,
    aggregateType: 'User',
    aggregateId: userId,
    eventType: ANALYTICS_EVENT_TYPES.USER_LOGIN,
    idempotencyKey: `evt:USER_LOGIN:${userId}:${new Date().toISOString().slice(0, 13)}`,
    actorType: 'user',
    actorId: userId,
    payload: {},
  });
}

/**
 * Phase 9 commerce wrappers — prefer `@/lib/admin/productAnalytics` producers.
 * Kept here so operational writers can import from the analytics plane.
 */
export {
  emitProductMeaningfulAction,
  emitSalesInvoicePosted,
  emitPosTransactionCompleted,
  emitMraEisTransactionAccepted,
} from '@/lib/admin/productAnalytics/producers.js';
