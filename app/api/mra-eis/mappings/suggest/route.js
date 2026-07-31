import { getUserFromSession } from '@/lib/auth';
import {
  generateBranchSiteSuggestions,
  generateTaxMappingSuggestions,
  generatePaymentMappingSuggestions,
} from '@/lib/mraEis/application/mapping/mappingSuggestions.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

export async function POST(request) {
  try {
    const session = { user: await getUserFromSession() };
    if (!session?.user?.tenantId) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    const body = await request.json().catch(() => ({}));
    const tenantId = session.user.tenantId;
    const environment = body.environment || 'SANDBOX';
    const kind = String(body.kind || 'SITE').toUpperCase();
    const persist = body.persist !== false;

    let data;
    if (kind === 'SITE') {
      data = await generateBranchSiteSuggestions({ tenantId, businessId: tenantId, environment, persist });
    } else if (kind === 'TAX') {
      data = await generateTaxMappingSuggestions({
        tenantId,
        businessId: tenantId,
        environment,
        localTaxRates: body.localTaxRates || [],
        persist,
      });
    } else if (kind === 'PAYMENT') {
      data = await generatePaymentMappingSuggestions({
        tenantId,
        businessId: tenantId,
        environment,
        localMethods: body.localMethods || [],
        persist,
      });
    } else {
      throw EisErrors.validation({ message: `Unsupported suggestion kind ${kind}` });
    }

    return eisJson({
      success: true,
      data: { ...data, autoActivated: false },
      message: 'Suggestions generated. They are not active mappings.',
      requestId: readRequestId(request),
    });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
