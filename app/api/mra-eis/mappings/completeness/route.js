import { getUserFromSession } from '@/lib/auth';
import { calculateMraEisMappingCompleteness } from '@/lib/mraEis/application/mapping/mappingCompleteness.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

export async function GET(request) {
  try {
    const session = { user: await getUserFromSession() };
    if (!session?.user?.tenantId) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    const { searchParams } = new URL(request.url);
    const data = await calculateMraEisMappingCompleteness({
      tenantId: session.user.tenantId,
      businessId: session.user.tenantId,
      environment: searchParams.get('environment') || 'SANDBOX',
    });
    return eisJson({ success: true, data, requestId: readRequestId(request) });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
