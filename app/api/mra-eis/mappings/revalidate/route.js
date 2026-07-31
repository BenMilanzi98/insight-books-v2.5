import { getUserFromSession } from '@/lib/auth';
import { revalidateMappingsForConfigurationChange } from '@/lib/mraEis/application/mapping/mappingRevalidation.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

export async function POST(request) {
  try {
    const session = { user: await getUserFromSession() };
    if (!session?.user?.tenantId) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    const body = await request.json().catch(() => ({}));
    const data = await revalidateMappingsForConfigurationChange({
      tenantId: session.user.tenantId,
      businessId: session.user.tenantId,
      environment: body.environment || 'SANDBOX',
      configurationSetChecksum: body.configurationSetChecksum || null,
      eventType: body.eventType || null,
      mappingKinds: body.mappingKinds || null,
    });
    return eisJson({
      success: true,
      data,
      message: 'Revalidation complete. Mappings were never auto-remapped.',
      requestId: readRequestId(request),
    });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
