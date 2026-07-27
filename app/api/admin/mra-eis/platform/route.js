import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  SYSTEM_EIS_PERMISSIONS,
  adminHasEisPermission,
  getPlatformEisSetting,
  ensurePlatformEisSetting,
  updatePlatformEisStatus,
} from '@/lib/mraEis/index.js';
import { eisJson, eisErrorResponse, requestMeta, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) return eisErrorResponse(EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' }));
    if (!adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.VIEW)) {
      return eisErrorResponse(EisErrors.permissionDenied());
    }
    await ensurePlatformEisSetting();
    const platform = await getPlatformEisSetting();
    return eisJson({ platform });
  } catch (err) {
    return eisErrorResponse(err);
  }
}

export async function PUT(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) return eisErrorResponse(EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' }));

    const body = await request.json();
    const meta = requestMeta(request);
    const isPause = body.status === 'EMERGENCY_PAUSED';
    const perm = isPause ? SYSTEM_EIS_PERMISSIONS.PLATFORM_PAUSE : SYSTEM_EIS_PERMISSIONS.PLATFORM_MANAGE;
    if (!adminHasEisPermission(admin, perm)) {
      return eisErrorResponse(EisErrors.permissionDenied());
    }

    const result = await updatePlatformEisStatus({
      admin,
      status: body.status,
      reason: body.reason,
      sandboxGloballyAllowed: body.sandboxGloballyAllowed,
      productionGloballyAllowed: body.productionGloballyAllowed,
      newEntitlementsAllowed: body.newEntitlementsAllowed,
      maintenanceMessage: body.maintenanceMessage,
      expectedVersion: body.expectedVersion,
      requestId: readRequestId(body, request),
      ...meta,
    });
    return eisJson(result);
  } catch (err) {
    return eisErrorResponse(err);
  }
}
