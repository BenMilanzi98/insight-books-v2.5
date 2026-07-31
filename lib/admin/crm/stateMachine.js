/**
 * CRM Lead status state machine (Phase 11 Wave 1 + Phase 12 Wave 1 gate).
 * Invalid transitions return { ok: false, error: 'INVALID_TRANSITION' } — never silent coerce.
 * CONVERTED_TO_OPPORTUNITY only when ctx.fromOpportunityCreate === true (Opportunity create path).
 */

import { CRM_LEAD_STATUS, CRM_TRANSITION_TABLE } from './catalogue.js';

/**
 * @param {string} from
 * @param {string} to
 * @param {{ fromOpportunityCreate?: boolean }} [opts]
 * @returns {boolean}
 */
export function canTransition(from, to, opts = {}) {
  const f = String(from || '').toUpperCase();
  const t = String(to || '').toUpperCase();
  if (t === CRM_LEAD_STATUS.CONVERTED_TO_OPPORTUNITY) {
    if (opts.fromOpportunityCreate !== true) return false;
    return (
      f === CRM_LEAD_STATUS.OPPORTUNITY_READY || f === CRM_LEAD_STATUS.QUALIFIED
    );
  }
  const allowed = CRM_TRANSITION_TABLE[f];
  if (!allowed) return false;
  return allowed.includes(t);
}

/**
 * Assert a Lead status transition with contextual rules.
 *
 * @param {string} from
 * @param {string} to
 * @param {{
 *   disqualificationReason?: string|null,
 *   reason?: string|null,
 *   fromOpportunityCreate?: boolean,
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

  if (t === CRM_LEAD_STATUS.CONVERTED_TO_OPPORTUNITY) {
    if (ctx.fromOpportunityCreate !== true) {
      return {
        ok: false,
        error: 'NOT_IMPLEMENTED',
        from: f,
        to: t,
        reason: 'converted_to_opportunity_requires_opportunity_create',
      };
    }
    if (
      f !== CRM_LEAD_STATUS.OPPORTUNITY_READY &&
      f !== CRM_LEAD_STATUS.QUALIFIED
    ) {
      return {
        ok: false,
        error: 'INVALID_TRANSITION',
        from: f,
        to: t,
        reason: 'converted_requires_qualified_or_opportunity_ready',
      };
    }
    return { ok: true, from: f, to: t };
  }

  if (!canTransition(f, t, ctx)) {
    return {
      ok: false,
      error: 'INVALID_TRANSITION',
      from: f,
      to: t,
      reason: 'not_in_transition_table',
    };
  }

  if (t === CRM_LEAD_STATUS.DISQUALIFIED) {
    const dq =
      ctx.disqualificationReason != null
        ? String(ctx.disqualificationReason).trim()
        : '';
    if (!dq) {
      return {
        ok: false,
        error: 'INVALID_TRANSITION',
        from: f,
        to: t,
        reason: 'disqualificationReason_required',
      };
    }
  }

  return { ok: true, from: f, to: t };
}
