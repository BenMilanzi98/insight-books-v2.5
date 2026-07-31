/**
 * Phase 20 Wave 3 — Request ≠ result honesty.
 * Never treat ACTIVATED / PROVISIONED / PAID / ACTIVE as terminal without
 * an authoritative provider result.
 */

export const CRM_FABRICATED_TERMINAL_STATUSES = Object.freeze([
  'ACTIVATED',
  'PROVISIONED',
  'PAID',
  'ACTIVE',
  'COMPLETED',
]);

export const CRM_HONEST_PENDING_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  PENDING_ACTIVATION: 'PENDING_ACTIVATION',
  PROVISIONING: 'PROVISIONING',
  REQUESTED: 'REQUESTED',
  INITIATED: 'INITIATED',
});

/**
 * Clamp a provision/request status so terminal success cannot be claimed
 * without providerConfirmed.
 */
export function clampProvisionRequestStatus(status, { providerConfirmed = false } = {}) {
  const raw = String(status || '').trim().toUpperCase();
  if (!raw) return CRM_HONEST_PENDING_STATUSES.PENDING;
  if (CRM_FABRICATED_TERMINAL_STATUSES.includes(raw) && !providerConfirmed) {
    if (raw === 'PAID') return CRM_HONEST_PENDING_STATUSES.PENDING;
    if (raw === 'ACTIVE' || raw === 'ACTIVATED') {
      return CRM_HONEST_PENDING_STATUSES.PENDING_ACTIVATION;
    }
    if (raw === 'PROVISIONED') return CRM_HONEST_PENDING_STATUSES.PROVISIONING;
    return CRM_HONEST_PENDING_STATUSES.PENDING;
  }
  return raw;
}

/**
 * Reject fabricated terminal provision results when providerResult is absent
 * or not authoritative (ok !== true).
 */
export function assertProvisionResultHonesty(result, { providerResult = null } = {}) {
  if (!result || typeof result !== 'object') {
    return { ok: false, error: 'provision_result_required' };
  }

  const providerOk =
    providerResult &&
    typeof providerResult === 'object' &&
    providerResult.ok === true &&
    providerResult.authoritative !== false;

  const status = String(result.status || '').trim().toUpperCase();
  const claimsTerminal =
    CRM_FABRICATED_TERMINAL_STATUSES.includes(status) ||
    result.isActive === true ||
    result.activated === true ||
    result.provisioned === true ||
    result.paid === true ||
    String(result.paymentStatus || '').toUpperCase() === 'PAID';

  if (claimsTerminal && !providerOk) {
    return {
      ok: false,
      error: 'fabricated_terminal_status_without_provider_result',
      status: clampProvisionRequestStatus(status || 'ACTIVATED', {
        providerConfirmed: false,
      }),
      activated: false,
      provisioned: false,
      paid: false,
      isActive: false,
    };
  }

  return {
    ok: true,
    result,
    status: clampProvisionRequestStatus(status, { providerConfirmed: providerOk }),
  };
}

/**
 * Strip caller forgeries that would jump to ACTIVE/PROVISIONED/PAID.
 */
export function stripFabricatedProvisionArgs(args = {}) {
  if (!args || typeof args !== 'object') return {};
  const out = { ...args };
  delete out.forceActive;
  delete out.forceActivated;
  delete out.forceProvisioned;
  delete out.forcePaid;
  delete out.activated;
  delete out.provisioned;
  delete out.paid;
  if (out.isActive === true) out.isActive = false;
  if (typeof out.status === 'string') {
    out.status = clampProvisionRequestStatus(out.status, { providerConfirmed: false });
  }
  return out;
}
