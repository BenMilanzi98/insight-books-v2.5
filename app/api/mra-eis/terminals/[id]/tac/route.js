import { getUserFromSession } from '@/lib/auth';
import { submitTacForTerminal } from '@/lib/mraEis/application/activation/activationOrchestrator.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';
import { tenantHasEisPermission, TENANT_EIS_PERMISSIONS } from '@/lib/mraEis/domain/permissions.js';

/** POST TAC in body only — never query/route params. */
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
    if (body.terminalActivationCode == null) {
      throw EisErrors.validation({ message: 'terminalActivationCode is required in the request body.' });
    }
    const result = await submitTacForTerminal({
      tenantId: user.tenantId,
      businessId: user.tenantId,
      terminalId: params.id,
      terminalActivationCode: body.terminalActivationCode,
      expectedVersion: body.expectedVersion,
      actorId: user.id,
    });
    return eisJson({ success: true, data: result, requestId: readRequestId(request) });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
