/**
 * Provisioning readiness honesty — Phase 21 Wave 2 (G21-07).
 * REQUESTED/PROCESSING ≠ READY/PROVISIONED without authoritative provider result.
 * Never fabricates Tenant/Business/Branch IDs.
 */

import { READINESS_STATUS } from './tenant.js';

const PENDING_STATUSES = new Set([
  'REQUESTED',
  'PROCESSING',
  'PENDING',
  'PROVISIONING',
  'INITIATED',
  'IN_PROGRESS',
]);

const TERMINAL_SUCCESS = new Set([
  'PROVISIONED',
  'READY',
  'ACTIVE',
  'ACTIVATED',
  'COMPLETED',
]);

function providerConfirmed(providerResult) {
  return (
    providerResult &&
    typeof providerResult === 'object' &&
    providerResult.ok === true &&
    providerResult.authoritative !== false
  );
}

function resolveProvisioningStatus(project, args = {}) {
  if (args.provisioningStatus != null) {
    return String(args.provisioningStatus).trim().toUpperCase();
  }
  const fromOwner =
    project?.ownerAssignmentsJson?.provisioningStatus ||
    project?.provisioningStatus ||
    null;
  if (fromOwner) return String(fromOwner).trim().toUpperCase();
  return '';
}

/**
 * @returns {{ status: string, evidence: object }}
 */
export async function evaluateProvisioningReadiness(prisma, project, args = {}) {
  if (args.dimensionOverrides?.provisioning) {
    return {
      status: String(args.dimensionOverrides.provisioning).toUpperCase(),
      evidence: { override: true },
    };
  }

  const status = resolveProvisioningStatus(project, args);
  const providerOk = providerConfirmed(args.providerResult);

  if (!status) {
    return {
      status: READINESS_STATUS.UNKNOWN,
      evidence: { reason: 'provisioning_status_unavailable' },
    };
  }

  if (PENDING_STATUSES.has(status)) {
    return {
      status: READINESS_STATUS.NOT_READY,
      evidence: {
        provisioningStatus: status,
        reason: 'request_not_provider_result',
      },
    };
  }

  if (TERMINAL_SUCCESS.has(status) && !providerOk) {
    return {
      status: READINESS_STATUS.NOT_READY,
      evidence: {
        provisioningStatus: status,
        reason: 'fabricated_terminal_without_provider_result',
        error: 'fabricated_terminal_without_provider_result',
      },
    };
  }

  if (TERMINAL_SUCCESS.has(status) && providerOk) {
    const providerTenantId = args.providerResult?.tenantId
      ? String(args.providerResult.tenantId).trim()
      : '';
    if (
      project?.tenantId &&
      providerTenantId &&
      providerTenantId !== String(project.tenantId).trim()
    ) {
      return {
        status: READINESS_STATUS.NOT_READY,
        evidence: {
          reason: 'provider_tenant_mismatch',
          provisioningStatus: status,
        },
      };
    }
    return {
      status: READINESS_STATUS.READY,
      evidence: {
        provisioningStatus: status,
        providerConfirmed: true,
        tenantId: providerTenantId || project?.tenantId || null,
      },
    };
  }

  return {
    status: READINESS_STATUS.NOT_READY,
    evidence: { provisioningStatus: status, reason: 'provisioning_not_ready' },
  };
}

/**
 * Fabricated Tenant identity without provider confirmation is forbidden.
 */
export function assertNoFabricatedTenantIdentity(args = {}) {
  const tenantId = args.tenantId != null ? String(args.tenantId).trim() : '';
  if (!tenantId) {
    return { ok: false, error: 'tenant_identity_required' };
  }
  if (!providerConfirmed(args.providerResult)) {
    return {
      ok: false,
      error: 'fabricated_tenant_identity_without_provider',
      tenantId,
    };
  }
  const providerTenantId = String(args.providerResult.tenantId || '').trim();
  if (providerTenantId && providerTenantId !== tenantId) {
    return {
      ok: false,
      error: 'fabricated_tenant_identity_mismatch',
      tenantId,
      providerTenantId,
    };
  }
  return { ok: true, tenantId };
}

/** Explicit refuse — onboarding must never mint Tenant identity. */
export async function refuseOnboardingTenantMint(_prisma, _args = {}) {
  return {
    ok: false,
    error: 'fabricated_tenant_mint_forbidden',
    reason: 'onboarding_must_not_mint_tenant_identity',
  };
}
