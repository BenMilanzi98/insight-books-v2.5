import { requireAdminAuth } from '@/lib/adminAuth.js';
import {
  SYSTEM_EIS_PERMISSIONS,
  adminHasEisPermission,
} from '@/lib/mraEis/domain/permissions.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';
import {
  CRYPTOGRAPHIC_VERSION_REGISTRY,
  getSecurityMetricsSnapshot,
  resolveMasterKey,
} from '@/lib/mraEis/security.js';

/** Metadata-only security health — never returns keys or ciphertext. */
export async function GET(request) {
  try {
    const admin = await requireAdminAuth(request);
    if (
      !adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.SECURITY_VIEW) &&
      !adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.VIEW)
    ) {
      throw EisErrors.permissionDenied();
    }

    let masterConfigured = false;
    let masterKeyIdFingerprint = null;
    try {
      const mk = resolveMasterKey({
        environment: process.env.MRA_EIS_DEPLOYMENT_ENV || process.env.NODE_ENV || 'development',
      });
      masterConfigured = true;
      masterKeyIdFingerprint = String(mk.keyId).slice(0, 40);
    } catch {
      masterConfigured = false;
    }

    const registrySummary = Object.fromEntries(
      Object.entries(CRYPTOGRAPHIC_VERSION_REGISTRY).map(([k, v]) => [
        k,
        {
          contractStatus: v.contractStatus,
          productionEnabled: Boolean(v.productionEnabled),
          algorithm: v.algorithm || null,
        },
      ])
    );

    return eisJson({
      success: true,
      data: {
        masterKeyConfigured: masterConfigured,
        masterKeyIdFingerprint,
        provider: 'ENV_ENVELOPE',
        plaintextRevealEndpoint: false,
        metrics: getSecurityMetricsSnapshot(),
        cryptoRegistry: registrySummary,
      },
      requestId: readRequestId(request),
    });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
