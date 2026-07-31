import { getUserFromSession } from '@/lib/auth';
import { runCatalogueSyncNow, requestCatalogueSync } from '@/lib/mraEis/application/catalogue/catalogueSyncOrchestrator.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

export async function POST(request) {
  try {
    const session = { user: await getUserFromSession() };
    if (!session?.user?.tenantId) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    const body = await request.json();
    if (!body.terminalId) throw EisErrors.validation({ message: 'terminalId is required' });

    const executeNow = body.executeNow !== false;
    const args = {
      tenantId: session.user.tenantId,
      businessId: session.user.tenantId,
      terminalId: body.terminalId,
      siteMappingId: body.siteMappingId || null,
      catalogueType: body.catalogueType || 'PRODUCTS',
      trigger: body.trigger || 'MANUAL',
      requestedBy: session.user.id,
      idempotencyKey: request.headers.get('idempotency-key') || body.idempotencyKey || null,
    };

    const result = executeNow
      ? { syncRun: await runCatalogueSyncNow(args), executed: true }
      : { ...(await requestCatalogueSync(args)), executed: false };

    return eisJson({
      success: true,
      data: result,
      message: 'Catalogue sync stores external records only. Local Products, prices, taxes and stock are never modified.',
      requestId: readRequestId(request),
    });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
