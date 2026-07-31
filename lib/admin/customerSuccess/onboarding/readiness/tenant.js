/**
 * Tenant readiness dimension — evaluate only; never mutate identity.
 */

export const READINESS_STATUS = Object.freeze({
  READY: 'READY',
  NOT_READY: 'NOT_READY',
  UNKNOWN: 'UNKNOWN',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

/**
 * @returns {{ status: string, evidence: object }}
 */
export async function evaluateTenantReadiness(prisma, project, args = {}) {
  if (!project?.tenantId) {
    return { status: READINESS_STATUS.UNKNOWN, evidence: { reason: 'tenant_pin_missing' } };
  }

  if (typeof prisma?.tenant?.findUnique === 'function') {
    const tenant = await prisma.tenant.findUnique({
      where: { id: project.tenantId },
    });
    if (!tenant) {
      return {
        status: READINESS_STATUS.NOT_READY,
        evidence: { reason: 'tenant_not_found', tenantId: project.tenantId },
      };
    }
    return {
      status: READINESS_STATUS.READY,
      evidence: { tenantId: project.tenantId, verified: true },
    };
  }

  // Without Tenant model in harness: pin present → UNKNOWN unless overridden
  if (args.dimensionOverrides?.tenant) {
    return {
      status: String(args.dimensionOverrides.tenant).toUpperCase(),
      evidence: { override: true },
    };
  }

  return {
    status: READINESS_STATUS.UNKNOWN,
    evidence: { reason: 'tenant_model_unavailable', tenantId: project.tenantId },
  };
}
