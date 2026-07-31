/**
 * Support ticket status state machine (Phase 10 Wave 1).
 * Invalid transitions return { ok: false, error: 'INVALID_TRANSITION' } — never silent coerce.
 */

import {
  SUPPORT_TICKET_STATUS,
  SUPPORT_TRANSITION_TABLE,
  SUPPORT_TERMINALISH_STATUSES,
} from './catalogue.js';

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function canTransition(from, to) {
  const f = String(from || '').toUpperCase();
  const t = String(to || '').toUpperCase();
  const allowed = SUPPORT_TRANSITION_TABLE[f];
  if (!allowed) return false;
  return allowed.includes(t);
}

/**
 * Assert a status transition with contextual rules.
 *
 * @param {string} from
 * @param {string} to
 * @param {{
 *   reason?: string|null,
 *   resolutionCategory?: string|null,
 * }} [ctx]
 * @returns {{ ok: true, from: string, to: string } | { ok: false, error: string, from: string, to: string, reason?: string }}
 */
export function assertTransition(from, to, ctx = {}) {
  const f = String(from || '').toUpperCase();
  const t = String(to || '').toUpperCase();

  if (!f || !t) {
    return {
      ok: false,
      error: 'INVALID_TRANSITION',
      from: f,
      to: t,
      reason: 'from_and_to_required',
    };
  }

  if (f === t) {
    return {
      ok: false,
      error: 'INVALID_TRANSITION',
      from: f,
      to: t,
      reason: 'same_status',
    };
  }

  if (!canTransition(f, t)) {
    return {
      ok: false,
      error: 'INVALID_TRANSITION',
      from: f,
      to: t,
      reason: 'not_in_transition_table',
    };
  }

  if (t === SUPPORT_TICKET_STATUS.RESOLVED) {
    const cat = ctx.resolutionCategory != null ? String(ctx.resolutionCategory).trim() : '';
    if (!cat) {
      return {
        ok: false,
        error: 'INVALID_TRANSITION',
        from: f,
        to: t,
        reason: 'resolutionCategory_required',
      };
    }
  }

  if (f === SUPPORT_TICKET_STATUS.CLOSED && t === SUPPORT_TICKET_STATUS.REOPENED) {
    const reason = ctx.reason != null ? String(ctx.reason).trim() : '';
    if (!reason) {
      return {
        ok: false,
        error: 'INVALID_TRANSITION',
        from: f,
        to: t,
        reason: 'reopen_reason_required',
      };
    }
  }

  if (SUPPORT_TERMINALISH_STATUSES.includes(t)) {
    const reason = ctx.reason != null ? String(ctx.reason).trim() : '';
    if (!reason) {
      return {
        ok: false,
        error: 'INVALID_TRANSITION',
        from: f,
        to: t,
        reason: 'terminal_reason_required',
      };
    }
  }

  return { ok: true, from: f, to: t };
}
