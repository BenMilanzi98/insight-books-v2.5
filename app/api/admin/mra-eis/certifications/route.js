import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  SYSTEM_EIS_PERMISSIONS,
  adminHasEisPermission,
  createCertificationRecord,
  verifyCertificationRecord,
} from '@/lib/mraEis/index.js';
import { eisJson, eisErrorResponse, requestMeta, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) return eisErrorResponse(EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' }));
    if (!adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.CERTIFICATION_MANAGE)) {
      return eisErrorResponse(EisErrors.permissionDenied());
    }
    const body = await request.json();
    const meta = requestMeta(request);

    if (body.action === 'verify') {
      return eisJson(
        await verifyCertificationRecord({
          admin,
          certificationId: body.certificationId,
          notes: body.notes,
          requestId: readRequestId(body, request),
          ...meta,
        })
      );
    }

    return eisJson(
      await createCertificationRecord({
        admin,
        tenantId: body.tenantId,
        businessId: body.businessId || null,
        productId: body.productId,
        productVersion: body.productVersion,
        certificationType: body.certificationType,
        status: body.status,
        certificateReference: body.certificateReference,
        evidenceDocumentReference: body.evidenceDocumentReference,
        effectiveFrom: body.effectiveFrom,
        effectiveUntil: body.effectiveUntil,
        notes: body.notes,
        requestId: readRequestId(body, request),
        ...meta,
      }),
      { status: 201 }
    );
  } catch (err) {
    return eisErrorResponse(err);
  }
}
