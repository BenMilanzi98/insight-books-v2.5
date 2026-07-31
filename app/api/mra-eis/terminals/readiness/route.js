import { getUserFromSession } from '@/lib/auth';
import { evaluateTerminalActivationReadiness } from '@/lib/mraEis/application/activation/readinessService.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

export async function GET(request) {
  try {
    const session = { user: await getUserFromSession() };
    if (!session?.user?.tenantId) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment') || 'SANDBOX';
    const branchId = searchParams.get('branchId');
    const readiness = await evaluateTerminalActivationReadiness({
      tenantId: session.user.tenantId,
      businessId: session.user.tenantId,
      branchId,
      environment,
      actorContext: { actorId: session.user.id },
    });
    return eisJson({ success: true, data: readiness, requestId: readRequestId(request) });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
