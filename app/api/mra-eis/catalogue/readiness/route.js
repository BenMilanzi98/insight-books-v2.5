import { getUserFromSession } from '@/lib/auth';
import { evaluateCatalogueSyncReadiness } from '@/lib/mraEis/application/catalogue/catalogueSyncReadiness.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

export async function GET(request) {
  try {
    const session = { user: await getUserFromSession() };
    if (!session?.user?.tenantId) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    const { searchParams } = new URL(request.url);
    const data = await evaluateCatalogueSyncReadiness({
      tenantId: session.user.tenantId,
      businessId: session.user.tenantId,
      terminalId: searchParams.get('terminalId'),
      siteMappingId: searchParams.get('siteMappingId'),
      environment: searchParams.get('environment') || 'SANDBOX',
      catalogueType: searchParams.get('catalogueType') || 'PRODUCTS',
      trigger: searchParams.get('trigger') || 'MANUAL',
      actorOrServiceContext: { actorId: session.user.id },
    });
    return eisJson({ success: true, data, requestId: readRequestId(request) });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
