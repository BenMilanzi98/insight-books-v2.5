import { getUserFromSession } from '@/lib/auth';
import {
  resolveMraSiteForTransaction,
  resolveMraTaxForSaleLine,
  resolveMraLevyForSaleLine,
  resolveMraPaymentRepresentation,
  buildResolvedMappingSnapshot,
} from '@/lib/mraEis/application/mapping/resolutionServices.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

export async function POST(request) {
  try {
    const session = { user: await getUserFromSession() };
    if (!session?.user?.tenantId) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    const body = await request.json();
    const tenantId = session.user.tenantId;
    const environment = body.environment || 'SANDBOX';
    const kind = String(body.kind || 'SITE').toUpperCase();
    const transactionDate = body.transactionDate ? new Date(body.transactionDate) : new Date();

    let data;
    if (kind === 'SITE') {
      data = await resolveMraSiteForTransaction({
        tenantId,
        businessId: tenantId,
        branchId: body.branchId,
        warehouseId: body.warehouseId,
        terminalId: body.terminalId,
        transactionDate,
        environment,
      });
    } else if (kind === 'TAX') {
      data = await resolveMraTaxForSaleLine({
        tenantId,
        businessId: tenantId,
        localTaxRateId: body.localTaxRateId,
        localTaxCategoryId: body.localTaxCategoryId,
        transactionDate,
        environment,
        localRate: body.localRate,
        treatmentType: body.treatmentType,
      });
    } else if (kind === 'LEVY') {
      data = await resolveMraLevyForSaleLine({
        tenantId,
        businessId: tenantId,
        localLevyId: body.localLevyId,
        transactionDate,
        environment,
      });
    } else if (kind === 'PAYMENT') {
      data = await resolveMraPaymentRepresentation({
        tenantId,
        businessId: tenantId,
        paymentComponents: body.paymentComponents || [],
        transactionType: body.transactionType || 'SALE',
        transactionDate,
        environment,
      });
    } else if (kind === 'SNAPSHOT') {
      const site = body.site || null;
      data = buildResolvedMappingSnapshot({
        site,
        warehouse: body.warehouse,
        taxes: body.taxes || [],
        levies: body.levies || [],
        payments: body.payments || [],
      });
    } else {
      throw EisErrors.validation({ message: `Unsupported resolve kind ${kind}` });
    }

    return eisJson({ success: true, data, requestId: readRequestId(request) });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
