import { getUserFromSession } from '@/lib/auth';
import { requestTerminalReactivation } from '@/lib/mraEis/application/activation/reactivationService.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';
import { tenantHasEisPermission, TENANT_EIS_PERMISSIONS } from '@/lib/mraEis/domain/permissions.js';
import { checkActivationRateLimit } from '@/lib/mraEis/application/activation/rateLimit.js';

export async function POST(request, { params }) {
  try {
    const user = await getUserFromSession();
    if (!user?.tenantId) {
      throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    }
    if (!tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.TERMINAL_REQUEST_REACTIVATION)) {
      throw EisErrors.permissionDenied();
    }
    const rl = checkActivationRateLimit({
      action: 'reactivate',
      tenantId: user.tenantId,
      businessId: user.tenantId,
      userId: user.id,
      terminalId: params.id,
      limit: 5,
    });
    if (!rl.allowed) {
      throw EisErrors.validation({ message: 'Rate limit exceeded for reactivation requests.' });
    }
    const body = await request.json();
    const result = await requestTerminalReactivation({
      tenantId: user.tenantId,
      businessId: user.tenantId,
      terminalId: params.id,
      reason: body.reason,
      approvalId: body.approvalId || null,
      actorId: user.id,
    });
    return eisJson({ success: true, data: result, requestId: readRequestId(request) });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
