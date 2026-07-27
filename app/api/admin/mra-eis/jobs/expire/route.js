import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  SYSTEM_EIS_PERMISSIONS,
  adminHasEisPermission,
  expireDueEntitlements,
  expireDueCertifications,
} from '@/lib/mraEis/index.js';
import { eisJson, eisErrorResponse } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

/** Idempotent expiry processor for entitlements and certifications. */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) return eisErrorResponse(EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' }));
    if (!adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.PLATFORM_MANAGE)) {
      return eisErrorResponse(EisErrors.permissionDenied());
    }
    const entitlements = await expireDueEntitlements();
    const certifications = await expireDueCertifications();
    return eisJson({ entitlements, certifications });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
