import { getUserFromSession } from '@/lib/auth';
import {
  generateProductMappingSuggestions,
  generateServiceMappingSuggestions,
} from '@/lib/mraEis/application/catalogue/productServiceSuggestions.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

export async function POST(request) {
  try {
    const session = { user: await getUserFromSession() };
    if (!session?.user?.tenantId) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    const body = await request.json().catch(() => ({}));
    const kind = String(body.kind || 'PRODUCT').toUpperCase();
    const args = {
      tenantId: session.user.tenantId,
      businessId: session.user.tenantId,
      environment: body.environment || 'SANDBOX',
      mraSiteId: body.mraSiteId || null,
      persist: body.persist !== false,
    };
    const data =
      kind === 'SERVICE'
        ? await generateServiceMappingSuggestions(args)
        : await generateProductMappingSuggestions(args);
    return eisJson({
      success: true,
      data: { ...data, autoActivated: false },
      message: 'Suggestions generated. They are never active until verified and activated.',
      requestId: readRequestId(request),
    });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
