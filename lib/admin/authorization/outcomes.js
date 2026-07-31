/** Canonical authorisation outcomes for the Admin control plane. */

export const AUTHZ_OUTCOMES = Object.freeze({
  ALLOW: 'ALLOW',
  DENY: 'DENY',
  ALLOW_READONLY: 'ALLOW_READONLY',
  ALLOW_MASKED: 'ALLOW_MASKED',
  ALLOW_AGGREGATE_ONLY: 'ALLOW_AGGREGATE_ONLY',
  REQUIRE_APPROVAL: 'REQUIRE_APPROVAL',
  REQUIRE_STEP_UP: 'REQUIRE_STEP_UP',
  REQUIRE_SUPPORT_CONTEXT: 'REQUIRE_SUPPORT_CONTEXT',
  REQUIRE_TENANT_SELECTION: 'REQUIRE_TENANT_SELECTION',
});

/**
 * @param {string} outcome
 * @returns {boolean}
 */
export function isAuthzAllowed(outcome) {
  return (
    outcome === AUTHZ_OUTCOMES.ALLOW ||
    outcome === AUTHZ_OUTCOMES.ALLOW_READONLY ||
    outcome === AUTHZ_OUTCOMES.ALLOW_MASKED ||
    outcome === AUTHZ_OUTCOMES.ALLOW_AGGREGATE_ONLY
  );
}
