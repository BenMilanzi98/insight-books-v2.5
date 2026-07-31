import { getUserFromSession } from '@/lib/auth';
import {
  TENANT_EIS_PERMISSIONS,
  tenantHasEisPermission,
  optInTenantToEis,
  pauseTenantEisParticipation,
  resumeTenantEisParticipation,
  optOutTenantFromEis,
} from '@/lib/mraEis/index.js';
import { eisJson, eisErrorResponse, requestMeta, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

export async function POST(request) {
  try {
    const user = await getUserFromSession();
    if (!user?.tenantId) {
      return eisErrorResponse(EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' }));
    }
    const body = await request.json();
    const action = String(body.action || '').toLowerCase();
    const meta = requestMeta(request);
    const base = {
      user,
      tenantId: user.tenantId,
      reason: body.reason,
      requestId: readRequestId(body, request),
      ...meta,
    };

    if (action === 'opt_in') {
      if (!tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.PARTICIPATION_ENABLE)) {
        return eisErrorResponse(EisErrors.permissionDenied());
      }
      return eisJson(await optInTenantToEis(base));
    }
    if (action === 'pause') {
      if (!tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.PARTICIPATION_PAUSE)) {
        return eisErrorResponse(EisErrors.permissionDenied());
      }
      return eisJson(await pauseTenantEisParticipation({ ...base, pauseMode: body.pauseMode }));
    }
    if (action === 'resume') {
      if (!tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.PARTICIPATION_ENABLE)) {
        return eisErrorResponse(EisErrors.permissionDenied());
      }
      return eisJson(await resumeTenantEisParticipation(base));
    }
    if (action === 'opt_out') {
      if (!tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.PARTICIPATION_DISABLE)) {
        return eisErrorResponse(EisErrors.permissionDenied());
      }
      return eisJson(await optOutTenantFromEis(base));
    }
    return eisErrorResponse(EisErrors.validation({ message: 'Unknown action.' }));
  } catch (err) {
    return eisErrorResponse(err);
  }
}
