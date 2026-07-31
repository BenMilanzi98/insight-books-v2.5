/**
 * Call catalogue — Phase 13 Wave 2.
 * Manual/planned only; telephony + recording NOT_AVAILABLE.
 */

import {
  CRM_CALL_STATUS,
  CRM_CALL_STATUSES,
  CRM_CALL_OUTCOME,
  CRM_CALL_OUTCOMES,
  CRM_CALL_NUMBER_RE,
  CRM_TELEPHONY_PROVIDER_STATUS,
  CRM_CALL_RECORDING_STATUS,
  CRM_ACTIVITY_DIRECTION,
} from '../catalogue.js';

export {
  CRM_CALL_STATUS,
  CRM_CALL_STATUSES,
  CRM_CALL_OUTCOME,
  CRM_CALL_OUTCOMES,
  CRM_CALL_NUMBER_RE,
  CRM_TELEPHONY_PROVIDER_STATUS,
  CRM_CALL_RECORDING_STATUS,
};

const OUTCOME_SET = new Set(CRM_CALL_OUTCOMES);
const DIRECTION_SET = new Set([
  CRM_ACTIVITY_DIRECTION.INBOUND,
  CRM_ACTIVITY_DIRECTION.OUTBOUND,
]);

/**
 * @param {string} outcome
 * @returns {boolean}
 */
export function isValidCallOutcome(outcome) {
  return OUTCOME_SET.has(String(outcome || '').trim().toUpperCase());
}

/**
 * @param {string} direction
 * @returns {boolean}
 */
export function isValidCallDirection(direction) {
  return DIRECTION_SET.has(String(direction || '').trim().toUpperCase());
}

/**
 * Typed telephony boundary — never fabricate live dialer connectivity.
 * @returns {{ status: 'NOT_AVAILABLE', recording: 'NOT_AVAILABLE', liveDial: false, inventConnectedForbidden: true }}
 */
export function getTelephonyProviderContract() {
  return Object.freeze({
    status: CRM_TELEPHONY_PROVIDER_STATUS,
    recording: CRM_CALL_RECORDING_STATUS,
    liveDial: false,
    inventConnectedForbidden: true,
    inventRecordingForbidden: true,
  });
}

/**
 * Recording always NOT_AVAILABLE this wave (legal/consent/retention stack absent).
 * @returns {'NOT_AVAILABLE'}
 */
export function getCallRecordingStatus() {
  return CRM_CALL_RECORDING_STATUS;
}
