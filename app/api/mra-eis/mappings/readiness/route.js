import { getUserFromSession } from '@/lib/auth';
import { evaluateMraEisMappingReadiness } from '@/lib/mraEis/application/mapping/mappingReadiness.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

export async function GET(request) {
  try {
    const session = { user: await getUserFromSession() };
    if (!session?.user?.tenantId) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    const { searchParams } = new URL(request.url);
    const readiness = await evaluateMraEisMappingReadiness({
      tenantId: session.user.tenantId,
      businessId: session.user.tenantId,
      environment: searchParams.get('environment') || 'SANDBOX',
      branchId: searchParams.get('branchId'),
      terminalId: searchParams.get('terminalId'),
      requestedOperation: searchParams.get('operation') || 'VIEW_MAPPINGS',
      actorContext: { actorId: session.user.id },
    });
    return eisJson({ success: true, data: readiness, requestId: readRequestId(request) });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
