/**
 * Deterministic Customer lifecycle stage from Tenant + subscription context.
 * Versioned rules; incomplete legacy data → limitation, not invented stage.
 */

import {
  LIFECYCLE_RULE_VERSION,
  LIFECYCLE_STAGES,
} from './catalogue.js';
import { INACTIVE_STATUSES } from '@/lib/admin/saasBillingKpis';

function normStatus(s) {
  return String(s || '').trim();
}

function isArchivedTenant(status) {
  const s = normStatus(status).toUpperCase();
  return s === 'ARCHIVED' || s === 'CLOSED';
}

function isSuspendedTenant(status) {
  const s = normStatus(status).toUpperCase();
  return (
    s === 'SUSPENDED' ||
    s === 'SUSPENSION_PENDING' ||
    s === 'RESTRICTED'
  );
}

function isPaymentOverdueTenant(status) {
  const s = normStatus(status).toUpperCase();
  return s === 'PAYMENT_OVERDUE';
}

function isInactiveSubStatus(status) {
  return INACTIVE_STATUSES.includes(status) || INACTIVE_STATUSES.includes(normStatus(status));
}

/**
 * Pick the most commercially relevant subscription from context.
 * @param {object|null|undefined} subscriptionContext
 */
export function pickPrimarySubscription(subscriptionContext) {
  if (!subscriptionContext) return null;
  if (subscriptionContext.activeSubscription) {
    return subscriptionContext.activeSubscription;
  }
  const list = subscriptionContext.subscriptions || [];
  if (!list.length) return null;
  const now = subscriptionContext.now || new Date();

  const activePaid = list.find(
    (s) =>
      s?.isActive &&
      !s?.isTrial &&
      s?.expiresAt &&
      new Date(s.expiresAt) > now &&
      !isInactiveSubStatus(s.status)
  );
  if (activePaid) return activePaid;

  const trial = list.find(
    (s) =>
      s?.isTrial &&
      s?.trialEndDate &&
      new Date(s.trialEndDate) > now &&
      !['Expired', 'expired', 'EXPIRED', 'cancelled', 'Cancelled', 'CANCELLED'].includes(
        s.status
      )
  );
  if (trial) return trial;

  return [...list].sort((a, b) => {
    const ta = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
    const tb = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
    return tb - ta;
  })[0];
}

/**
 * @param {{ status?: string, createdAt?: Date|string, updatedAt?: Date|string }|null} tenant
 * @param {{
 *   activeSubscription?: object|null,
 *   subscriptions?: object[],
 *   hasOutstanding?: boolean,
 *   cancellationScheduled?: boolean,
 *   previouslySuspended?: boolean,
 *   now?: Date,
 * }|null} [subscriptionContext]
 * @returns {{ stage: string, ruleVersion: string, enteredAt: string|null, limitations: string[] }}
 */
export function resolveLifecycleStage(tenant, subscriptionContext = null) {
  const limitations = [];
  const now = subscriptionContext?.now || new Date();
  const status = tenant?.status;
  const sub = pickPrimarySubscription(subscriptionContext);
  const hasOutstanding = Boolean(subscriptionContext?.hasOutstanding);
  const cancellationScheduled = Boolean(subscriptionContext?.cancellationScheduled);
  const previouslySuspended = Boolean(subscriptionContext?.previouslySuspended);

  if (!tenant) {
    return {
      stage: LIFECYCLE_STAGES.CREATED,
      ruleVersion: LIFECYCLE_RULE_VERSION,
      enteredAt: null,
      limitations: ['Tenant missing; defaulted to CREATED'],
    };
  }

  if (isArchivedTenant(status)) {
    return {
      stage: LIFECYCLE_STAGES.ARCHIVED,
      ruleVersion: LIFECYCLE_RULE_VERSION,
      enteredAt: tenant.updatedAt ? new Date(tenant.updatedAt).toISOString() : null,
      limitations,
    };
  }

  if (isSuspendedTenant(status)) {
    return {
      stage: LIFECYCLE_STAGES.SUSPENDED,
      ruleVersion: LIFECYCLE_RULE_VERSION,
      enteredAt: tenant.updatedAt ? new Date(tenant.updatedAt).toISOString() : null,
      limitations,
    };
  }

  if (cancellationScheduled) {
    return {
      stage: LIFECYCLE_STAGES.CANCELLATION_SCHEDULED,
      ruleVersion: LIFECYCLE_RULE_VERSION,
      enteredAt: sub?.updatedAt ? new Date(sub.updatedAt).toISOString() : null,
      limitations: [
        ...limitations,
        'Cancellation schedule derived from explicit context flag (no dedicated cancel-at field).',
      ],
    };
  }

  if (isPaymentOverdueTenant(status)) {
    return {
      stage: LIFECYCLE_STAGES.PAYMENT_DELINQUENT,
      ruleVersion: LIFECYCLE_RULE_VERSION,
      enteredAt: tenant.updatedAt ? new Date(tenant.updatedAt).toISOString() : null,
      limitations,
    };
  }

  if (sub?.isTrial && sub?.trialEndDate && new Date(sub.trialEndDate) > now) {
    return {
      stage: LIFECYCLE_STAGES.TRIAL,
      ruleVersion: LIFECYCLE_RULE_VERSION,
      enteredAt: sub.trialStartDate
        ? new Date(sub.trialStartDate).toISOString()
        : sub.startedAt
          ? new Date(sub.startedAt).toISOString()
          : null,
      limitations,
    };
  }

  const trialActiveByTenant =
    normStatus(status).toUpperCase() === 'TRIAL' || normStatus(status) === 'trial';
  if (trialActiveByTenant && !sub) {
    limitations.push('TRIAL from Tenant.status without an active trial subscription row.');
    return {
      stage: LIFECYCLE_STAGES.TRIAL,
      ruleVersion: LIFECYCLE_RULE_VERSION,
      enteredAt: tenant.createdAt ? new Date(tenant.createdAt).toISOString() : null,
      limitations,
    };
  }

  const paidActive =
    sub &&
    sub.isActive &&
    !sub.isTrial &&
    sub.expiresAt &&
    new Date(sub.expiresAt) > now &&
    !isInactiveSubStatus(sub.status);

  // Outstanding alone does not override active paid; use when no paid access.
  if (hasOutstanding && !paidActive) {
    limitations.push(
      'PAYMENT_DELINQUENT inferred from outstanding platform invoices without active paid access.'
    );
    return {
      stage: LIFECYCLE_STAGES.PAYMENT_DELINQUENT,
      ruleVersion: LIFECYCLE_RULE_VERSION,
      enteredAt: tenant.updatedAt ? new Date(tenant.updatedAt).toISOString() : null,
      limitations,
    };
  }

  if (paidActive) {
    if (previouslySuspended) {
      return {
        stage: LIFECYCLE_STAGES.REACTIVATED,
        ruleVersion: LIFECYCLE_RULE_VERSION,
        enteredAt: sub.startedAt ? new Date(sub.startedAt).toISOString() : null,
        limitations: [
          ...limitations,
          'REACTIVATED requires previouslySuspended context; history table not yet modelled.',
        ],
      };
    }
    return {
      stage: LIFECYCLE_STAGES.ACTIVE_PAID,
      ruleVersion: LIFECYCLE_RULE_VERSION,
      enteredAt: sub.startedAt ? new Date(sub.startedAt).toISOString() : null,
      limitations,
    };
  }

  // Cancelled / expired commercial relationship → CHURNED
  if (
    sub &&
    (isInactiveSubStatus(sub.status) ||
      (sub.expiresAt && new Date(sub.expiresAt) <= now) ||
      (sub.isTrial && sub.trialEndDate && new Date(sub.trialEndDate) <= now))
  ) {
    limitations.push(
      'CHURNED inferred from subscription expiry/cancel; no dedicated churn event store.'
    );
    return {
      stage: LIFECYCLE_STAGES.CHURNED,
      ruleVersion: LIFECYCLE_RULE_VERSION,
      enteredAt: sub.expiresAt
        ? new Date(sub.expiresAt).toISOString()
        : sub.trialEndDate
          ? new Date(sub.trialEndDate).toISOString()
          : null,
      limitations,
    };
  }

  if (!sub) {
    limitations.push(
      'No AccountSubscription context; stage defaults to CREATED from Tenant identity only.'
    );
  } else {
    limitations.push(
      'Subscription present but not matching paid/trial active rules; defaulted to CREATED.'
    );
  }

  return {
    stage: LIFECYCLE_STAGES.CREATED,
    ruleVersion: LIFECYCLE_RULE_VERSION,
    enteredAt: tenant.createdAt ? new Date(tenant.createdAt).toISOString() : null,
    limitations,
  };
}
