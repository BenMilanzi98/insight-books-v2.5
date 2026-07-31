/**
 * Customer Success catalogue — cases, tasks, interventions, renewals (Phase 8 Wave 3).
 * CS actions never mutate AccountSubscription / PlatformInvoice / EIS source facts.
 */

import { SIGNAL_CODES } from '@/lib/admin/customers/signalCatalogue.js';

export const CS_CASE_DEFINITION_VERSION = 'customer-success-cases-2026-07-28';

export const CS_TRIGGER_TYPE = Object.freeze({
  SIGNAL: 'SIGNAL',
  HEALTH: 'HEALTH',
  MANUAL: 'MANUAL',
});

export const CS_CASE_STATUS = Object.freeze({
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
});

/** Statuses that block a second open case for the same idempotency key. */
export const CS_OPEN_CASE_STATUSES = Object.freeze([
  CS_CASE_STATUS.OPEN,
  CS_CASE_STATUS.IN_PROGRESS,
]);

export const CS_CASE_PRIORITY = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

export const CS_TASK_STATUS = Object.freeze({
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
});

export const CS_RENEWAL_STATUS = Object.freeze({
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  CLOSED: 'CLOSED',
});

export const CS_RENEWAL_OUTCOME = Object.freeze({
  RENEWED: 'RENEWED',
  EXTENDED: 'EXTENDED',
  CHURNED: 'CHURNED',
  LOST: 'LOST',
  PENDING: 'PENDING',
});

export const CS_PLAYBOOK_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
});

export const CS_PLAYBOOK_EXECUTION_STATUS = Object.freeze({
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

export const CS_SUCCESS_PLAN_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

export const CS_SUCCESS_GOAL_STATUS = Object.freeze({
  OPEN: 'OPEN',
  MET: 'MET',
  MISSED: 'MISSED',
  CANCELLED: 'CANCELLED',
});

export const CS_HANDOFF_STATUS = Object.freeze({
  OPEN: 'OPEN',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  CLOSED: 'CLOSED',
});

/** Record-only recommended actions — never auto-upgrade subscription. */
export const CS_HANDOFF_ACTION = Object.freeze({
  UPGRADE_HANDOFF: 'UPGRADE_HANDOFF',
  EXPANSION_DISCUSS: 'EXPANSION_DISCUSS',
  OTHER: 'OTHER',
});

/** Source-gated foundation statuses — never invent progress from logins. */
export const CS_FOUNDATION_STATUS = Object.freeze({
  NOT_INSTRUMENTED: 'NOT_INSTRUMENTED',
  INSTRUMENTED: 'INSTRUMENTED',
  UNAVAILABLE: 'UNAVAILABLE',
});

export const CS_FOUNDATION_KIND = Object.freeze({
  ONBOARDING: 'onboarding',
  TRAINING: 'training',
  SURVEY: 'survey',
  PLANS: 'plans',
});

/** Health bands that may auto-open a case (workflow matrix). */
export const CS_HEALTH_CASE_BANDS = Object.freeze(['AT_RISK', 'CRITICAL']);

/**
 * Deterministic playbook execution idempotency key.
 * Format: playbookKey+playbookVersion+tenantId+caseId|NONE
 */
export function playbookExecutionIdempotencyKey({
  playbookKey,
  playbookVersion,
  tenantId,
  caseId,
}) {
  const key = String(playbookKey || '').trim();
  const ver = String(playbookVersion || '').trim();
  const tid = String(tenantId || '').trim();
  const cid = caseId ? String(caseId).trim() : 'NONE';
  return `${key}+${ver}+${tid}+${cid}`;
}

/**
 * Deterministic task key for a playbook step within an execution.
 * Format: executionId+stepId
 */
export function playbookStepTaskIdempotencyKey(executionId, stepId) {
  return `${String(executionId || '').trim()}+${String(stepId || '').trim()}`;
}

/**
 * Allowed signal→case codes (CS_WORKFLOW_MATRIX v1).
 * Never FEATURE_USED, CHURN_PROBABILITY, SUPPORT_*, ONBOARDING_*, TRAINING_*.
 */
export const ALLOWED_SIGNAL_CASE_CODES = Object.freeze([
  SIGNAL_CODES.NO_MEANINGFUL_ACTIVITY,
  SIGNAL_CODES.RENEWAL_DUE_SOON,
  SIGNAL_CODES.HIGH_OUTSTANDING_BALANCE,
  SIGNAL_CODES.SUBSCRIPTION_SUSPENDED,
  SIGNAL_CODES.MRA_EIS_ENTITLEMENT_PENDING,
  SIGNAL_CODES.CUSTOMER_OWNER_MISSING,
]);

export const ALLOWED_SIGNAL_CASE_CODE_SET = new Set(ALLOWED_SIGNAL_CASE_CODES);

/**
 * Deterministic idempotency key for case automation.
 * Format: tenantId+triggerType+triggerCode+definitionVersion
 * Health callers append +day inside definitionVersion (or as part of triggerCode chain).
 *
 * @param {{
 *   tenantId: string,
 *   triggerType: string,
 *   triggerCode: string,
 *   definitionVersion: string,
 * }} args
 * @returns {string}
 */
export function idempotencyKey({
  tenantId,
  triggerType,
  triggerCode,
  definitionVersion,
}) {
  const tid = String(tenantId || '').trim();
  const type = String(triggerType || '').trim().toUpperCase();
  const code = String(triggerCode || '').trim();
  const ver = String(definitionVersion || '').trim();
  return `${tid}+${type}+${code}+${ver}`;
}

/**
 * Health idempotency version fragment: definitionVersion+UTC day.
 * @param {string} definitionVersion
 * @param {Date} [asOf]
 */
export function healthIdempotencyVersion(definitionVersion, asOf = new Date()) {
  const day = (asOf instanceof Date ? asOf : new Date(asOf || Date.now()))
    .toISOString()
    .slice(0, 10);
  return `${definitionVersion || 'unknown'}+${day}`;
}
