import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  SYSTEM_EIS_PERMISSIONS,
  adminHasEisPermission,
  listEntitlements,
  grantTenantEntitlement,
  ENTITLEMENT_STATUS,
} from '@/lib/mraEis/index.js';
import { eisJson, eisErrorResponse, requestMeta, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) return eisErrorResponse(EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' }));
    if (!adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.ENTITLEMENT_VIEW)) {
      return eisErrorResponse(EisErrors.permissionDenied());
    }
    const { searchParams } = new URL(request.url);
    const result = await listEntitlements({
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      environment: searchParams.get('environment') || undefined,
      take: Number(searchParams.get('take') || 50),
      skip: Number(searchParams.get('skip') || 0),
    });
    return eisJson(result);
  } catch (err) {
    return eisErrorResponse(err);
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) return eisErrorResponse(EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' }));
    if (!adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.ENTITLEMENT_GRANT)) {
      return eisErrorResponse(EisErrors.permissionDenied());
    }

    const body = await request.json();
    const meta = requestMeta(request);
    const production = body.targetStatus === ENTITLEMENT_STATUS.ENTITLED_PRODUCTION || body.production === true;
    const result = await grantTenantEntitlement({
      admin,
      tenantId: body.tenantId,
      targetStatus: production
        ? ENTITLEMENT_STATUS.ENTITLED_PRODUCTION
        : ENTITLEMENT_STATUS.ENTITLED_SANDBOX_ONLY,
      reason: body.reason,
      source: body.source,
      effectiveFrom: body.effectiveFrom,
      effectiveUntil: body.effectiveUntil,
      certificationRequirement: body.certificationRequirement !== false,
      productionApprovalRequired: Boolean(body.productionApprovalRequired),
      approvalReference: body.approvalReference || null,
      requestId: readRequestId(body, request),
      ...meta,
    });
    return eisJson(result, { status: 201 });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
