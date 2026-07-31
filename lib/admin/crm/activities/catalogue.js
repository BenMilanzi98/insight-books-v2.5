/**
 * Activity catalogue helpers — Phase 13 Wave 1.
 * Re-exports + type↔status compatibility (fail-closed).
 */

import {
  CRM_ACTIVITY_TYPE,
  CRM_ACTIVITY_TYPES,
  CRM_ACTIVITY_TYPES_WAVE1,
  CRM_ACTIVITY_TYPES_WAVE2,
  CRM_ACTIVITY_TYPES_WAVE3,
  CRM_ACTIVITY_TYPES_CREATABLE,
  CRM_ACTIVITY_STATUS,
  CRM_ACTIVITY_STATUSES,
  CRM_ACTIVITY_DIRECTION,
  CRM_ACTIVITY_DIRECTIONS,
  CRM_ACTIVITY_TYPE_STATUS_COMPAT,
  CRM_ACTIVITY_RELATION_ROLE,
  CRM_ACTIVITY_NUMBER_RE,
  CRM_TASK_NUMBER_RE,
  CRM_CALL_NUMBER_RE,
  CRM_FOLLOW_UP_STATUS,
  CRM_FOLLOW_UP_STATUSES,
  CRM_NEXT_ACTION_STATUS,
  CRM_NEXT_ACTION_STATUSES,
} from '../catalogue.js';

/**
 * @param {string} type
 * @param {string} status
 * @returns {boolean}
 */
export function isActivityStatusCompatible(type, status) {
  const t = String(type || '').trim().toUpperCase();
  const s = String(status || '').trim().toUpperCase();
  const allowed = CRM_ACTIVITY_TYPE_STATUS_COMPAT[t];
  if (!allowed) return false;
  return allowed.includes(s);
}

/**
 * Allowed Activity status transitions (Wave 1 fail-closed).
 * Due-date pass never appears here as an auto-complete edge.
 */
export const CRM_ACTIVITY_STATUS_TRANSITIONS = Object.freeze({
  [CRM_ACTIVITY_STATUS.PLANNED]: Object.freeze([
    CRM_ACTIVITY_STATUS.OPEN,
    CRM_ACTIVITY_STATUS.IN_PROGRESS,
    CRM_ACTIVITY_STATUS.COMPLETED,
    CRM_ACTIVITY_STATUS.CANCELLED,
    CRM_ACTIVITY_STATUS.BLOCKED_BY_CONSENT,
  ]),
  [CRM_ACTIVITY_STATUS.OPEN]: Object.freeze([
    CRM_ACTIVITY_STATUS.IN_PROGRESS,
    CRM_ACTIVITY_STATUS.COMPLETED,
    CRM_ACTIVITY_STATUS.CANCELLED,
    CRM_ACTIVITY_STATUS.BLOCKED_BY_CONSENT,
    CRM_ACTIVITY_STATUS.PLANNED,
  ]),
  [CRM_ACTIVITY_STATUS.IN_PROGRESS]: Object.freeze([
    CRM_ACTIVITY_STATUS.OPEN,
    CRM_ACTIVITY_STATUS.COMPLETED,
    CRM_ACTIVITY_STATUS.CANCELLED,
  ]),
  [CRM_ACTIVITY_STATUS.COMPLETED]: Object.freeze([CRM_ACTIVITY_STATUS.OPEN]),
  [CRM_ACTIVITY_STATUS.CANCELLED]: Object.freeze([CRM_ACTIVITY_STATUS.OPEN]),
  [CRM_ACTIVITY_STATUS.BLOCKED_BY_CONSENT]: Object.freeze([
    CRM_ACTIVITY_STATUS.PLANNED,
    CRM_ACTIVITY_STATUS.OPEN,
    CRM_ACTIVITY_STATUS.CANCELLED,
  ]),
});

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function canTransitionActivityStatus(from, to) {
  const f = String(from || '').trim().toUpperCase();
  const t = String(to || '').trim().toUpperCase();
  if (f === t) return true;
  const allowed = CRM_ACTIVITY_STATUS_TRANSITIONS[f];
  return Boolean(allowed && allowed.includes(t));
}

export {
  CRM_ACTIVITY_TYPE,
  CRM_ACTIVITY_TYPES,
  CRM_ACTIVITY_TYPES_WAVE1,
  CRM_ACTIVITY_TYPES_WAVE2,
  CRM_ACTIVITY_TYPES_WAVE3,
  CRM_ACTIVITY_TYPES_CREATABLE,
  CRM_ACTIVITY_STATUS,
  CRM_ACTIVITY_STATUSES,
  CRM_ACTIVITY_DIRECTION,
  CRM_ACTIVITY_DIRECTIONS,
  CRM_ACTIVITY_TYPE_STATUS_COMPAT,
  CRM_ACTIVITY_RELATION_ROLE,
  CRM_ACTIVITY_NUMBER_RE,
  CRM_TASK_NUMBER_RE,
  CRM_CALL_NUMBER_RE,
  CRM_FOLLOW_UP_STATUS,
  CRM_FOLLOW_UP_STATUSES,
  CRM_NEXT_ACTION_STATUS,
  CRM_NEXT_ACTION_STATUSES,
};
