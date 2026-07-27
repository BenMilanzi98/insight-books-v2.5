import { requireAdminAuth } from '@/lib/adminAuth.js';
import {
  SYSTEM_EIS_PERMISSIONS,
  adminHasEisPermission,
} from '@/lib/mraEis/domain/permissions.js';
import { getCredentialMetadata } from '@/lib/mraEis/security.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

/**
 * GET credential metadata only — never plaintext / ciphertext.
 */
export async function GET(request, { params }) {
  try {
    const admin = await requireAdminAuth(request);
    if (!adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.CREDENTIALS_VIEW_METADATA) &&
        !adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.SECURITY_VIEW) &&
        !adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.VIEW)) {
      throw EisErrors.permissionDenied();
    }
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) throw EisErrors.validation({ message: 'tenantId is required.' });
    const id = params.id;
    const meta = await getCredentialMetadata({
      tenantId,
      businessId: tenantId,
      credentialReferenceId: id,
    });
    return eisJson({ success: true, data: meta, requestId: readRequestId(request) });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
