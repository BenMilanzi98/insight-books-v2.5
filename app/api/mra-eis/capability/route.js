import { getUserFromSession } from '@/lib/auth';
import { evaluateTenantEisCapability, EIS_OPERATION } from '@/lib/mraEis/index.js';
import { eisJson, eisErrorResponse } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

export async function GET(request) {
  try {
    const user = await getUserFromSession();
    if (!user?.tenantId) {
      return eisErrorResponse(EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' }));
    }
    const { searchParams } = new URL(request.url);
    const operation = searchParams.get('operation') || EIS_OPERATION.VIEW_EIS;
    const environment = searchParams.get('environment') || undefined;
    const capability = await evaluateTenantEisCapability({
      tenantId: user.tenantId,
      businessId: user.tenantId,
      requestedOperation: operation,
      environment,
      actorContext: { userId: user.id },
    });
    return eisJson({ capability });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
