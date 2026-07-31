import { getUserFromSession } from '@/lib/auth';
import { listMraSites } from '@/lib/mraEis/application/mapping/siteCatalogue.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

export async function GET(request) {
  try {
    const session = { user: await getUserFromSession() };
    if (!session?.user?.tenantId) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    const { searchParams } = new URL(request.url);
    const data = await listMraSites({
      tenantId: session.user.tenantId,
      businessId: session.user.tenantId,
      environment: searchParams.get('environment') || 'SANDBOX',
      includeInactive: searchParams.get('includeInactive') !== 'false',
    });
    return eisJson({ success: true, data, requestId: readRequestId(request) });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
