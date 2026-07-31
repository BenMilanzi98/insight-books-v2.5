import { getUserFromSession } from '@/lib/auth';
import {
  TENANT_EIS_PERMISSIONS,
  tenantHasEisPermission,
  listBusinessEisSettings,
  startBusinessEisSetup,
  updateBusinessEisPreferences,
  enableBusinessEisOperation,
  pauseBusinessEisOperation,
  resumeBusinessEisOperation,
  disableBusinessEis,
} from '@/lib/mraEis/index.js';
import { eisJson, eisErrorResponse, requestMeta, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

export async function GET() {
  try {
    const user = await getUserFromSession();
    if (!user?.tenantId) {
      return eisErrorResponse(EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' }));
    }
    if (!tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.BUSINESS_VIEW)) {
      return eisErrorResponse(EisErrors.permissionDenied());
    }
    const settings = await listBusinessEisSettings(user.tenantId);
    return eisJson({ settings, businessId: user.tenantId });
  } catch (err) {
    return eisErrorResponse(err);
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromSession();
    if (!user?.tenantId) {
      return eisErrorResponse(EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' }));
    }
    const body = await request.json();
    const action = String(body.action || '').toLowerCase();
    const meta = requestMeta(request);
    const businessId = body.businessId || user.tenantId;
    if (businessId !== user.tenantId) {
      return eisErrorResponse(EisErrors.crossTenant({ tenantId: user.tenantId, businessId }));
    }
    const base = {
      user,
      tenantId: user.tenantId,
      businessId,
      reason: body.reason,
      requestId: readRequestId(body, request),
      ...meta,
    };

    if (action === 'start_setup' || action === 'resume_setup') {
      if (!tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.SETUP_START)) {
        return eisErrorResponse(EisErrors.permissionDenied());
      }
      return eisJson(
        await startBusinessEisSetup({
          ...base,
          selectedEnvironment: body.selectedEnvironment,
        })
      );
    }
    if (action === 'update_preferences') {
      if (!tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.BUSINESS_MANAGE)) {
        return eisErrorResponse(EisErrors.permissionDenied());
      }
      return eisJson(
        await updateBusinessEisPreferences({
          ...base,
          preferredOperationMode: body.preferredOperationMode,
          receiptPolicy: body.receiptPolicy,
          autoRetryPreference: body.autoRetryPreference,
          selectedEnvironment: body.selectedEnvironment,
          expectedVersion: body.expectedVersion,
        })
      );
    }
    if (action === 'enable') {
      if (!tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.BUSINESS_MANAGE)) {
        return eisErrorResponse(EisErrors.permissionDenied());
      }
      return eisJson(await enableBusinessEisOperation(base));
    }
    if (action === 'pause') {
      if (!tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.BUSINESS_MANAGE)) {
        return eisErrorResponse(EisErrors.permissionDenied());
      }
      return eisJson(await pauseBusinessEisOperation(base));
    }
    if (action === 'resume') {
      if (!tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.BUSINESS_MANAGE)) {
        return eisErrorResponse(EisErrors.permissionDenied());
      }
      return eisJson(await resumeBusinessEisOperation(base));
    }
    if (action === 'disable') {
      if (!tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.PARTICIPATION_DISABLE)) {
        return eisErrorResponse(EisErrors.permissionDenied());
      }
      return eisJson(await disableBusinessEis({ ...base, mode: body.mode }));
    }
    return eisErrorResponse(EisErrors.validation({ message: 'Unknown action.' }));
  } catch (err) {
    return eisErrorResponse(err);
  }
}
