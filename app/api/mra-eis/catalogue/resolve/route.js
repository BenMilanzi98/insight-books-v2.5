import { getUserFromSession } from '@/lib/auth';
import {
  resolveMraProductForSaleLine,
  resolveMraServiceForSaleLine,
  buildResolvedItemMappingSnapshot,
} from '@/lib/mraEis/application/catalogue/productServiceResolution.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

export async function POST(request) {
  try {
    const session = { user: await getUserFromSession() };
    if (!session?.user?.tenantId) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    const body = await request.json();
    const tenantId = session.user.tenantId;
    const kind = String(body.kind || 'PRODUCT').toUpperCase();
    let data;
    if (kind === 'SERVICE') {
      data = await resolveMraServiceForSaleLine({
        tenantId,
        businessId: tenantId,
        branchId: body.branchId,
        terminalId: body.terminalId,
        localServiceId: body.localServiceId,
        transactionDate: body.transactionDate ? new Date(body.transactionDate) : new Date(),
        environment: body.environment || 'SANDBOX',
        quantity: body.quantity,
        localUnitOrBasis: body.localUnitOrBasis || 'EA',
        localTaxRateId: body.localTaxRateId,
        localLevyIds: body.localLevyIds || [],
      });
    } else if (kind === 'SNAPSHOT') {
      data = buildResolvedItemMappingSnapshot(body.resolution, body.meta || {});
    } else {
      data = await resolveMraProductForSaleLine({
        tenantId,
        businessId: tenantId,
        branchId: body.branchId,
        warehouseId: body.warehouseId,
        terminalId: body.terminalId,
        localProductId: body.localProductId,
        localProductVariantId: body.localProductVariantId,
        transactionDate: body.transactionDate ? new Date(body.transactionDate) : new Date(),
        environment: body.environment || 'SANDBOX',
        quantity: body.quantity,
        localUnitOfMeasure: body.localUnitOfMeasure || 'EA',
        localTaxRateId: body.localTaxRateId,
        localLevyIds: body.localLevyIds || [],
      });
    }
    return eisJson({ success: true, data, requestId: readRequestId(request) });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
