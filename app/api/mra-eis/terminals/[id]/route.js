import { getUserFromSession } from '@/lib/auth';
import { getTerminalHealth } from '@/lib/mraEis/application/activation/terminalHealthService.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';
import { tenantHasEisPermission, TENANT_EIS_PERMISSIONS } from '@/lib/mraEis/domain/permissions.js';

export async function GET(request, { params }) {
  try {
    const user = await getUserFromSession();
    if (!user?.tenantId) {
      throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    }
    if (!tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.TERMINAL_VIEW)) {
      throw EisErrors.permissionDenied();
    }
    const health = await getTerminalHealth({
      tenantId: user.tenantId,
      businessId: user.tenantId,
      terminalId: params.id,
    });
    if (!health) throw EisErrors.terminalNotFound({ tenantId: user.tenantId });
    return eisJson({ success: true, data: health, requestId: readRequestId(request) });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
