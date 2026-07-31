import { getUserFromSession } from '@/lib/auth';
import { runTerminalActivation } from '@/lib/mraEis/application/activation/activationOrchestrator.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';
import { tenantHasEisPermission, TENANT_EIS_PERMISSIONS } from '@/lib/mraEis/domain/permissions.js';

export async function POST(request, { params }) {
  try {
    const user = await getUserFromSession();
    if (!user?.tenantId) {
      throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    }
    if (!tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.TERMINAL_ACTIVATE)) {
      throw EisErrors.permissionDenied();
    }
    const body = await request.json();
    if (!body.tacReferenceId) {
      throw EisErrors.validation({ message: 'tacReferenceId is required.' });
    }
    const result = await runTerminalActivation({
      tenantId: user.tenantId,
      businessId: user.tenantId,
      terminalId: params.id,
      tacReferenceId: body.tacReferenceId,
      idempotencyKey: request.headers.get('idempotency-key') || body.idempotencyKey,
      actorId: user.id,
      requestId: readRequestId(request),
    });
    return eisJson({ success: true, data: result, requestId: readRequestId(request) });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
