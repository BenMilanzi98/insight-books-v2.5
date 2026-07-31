import { getUserFromSession } from '@/lib/auth';
import prisma from '@/lib/prisma.js';
import { createSiteMapping, createTaxMapping, createPaymentMethodMapping, createLevyMapping } from '@/lib/mraEis/application/services/mappingService.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';
import { MAPPING_STATUS } from '@/lib/mraEis/domain/operationalEnums.js';

export async function GET(request) {
  try {
    const session = { user: await getUserFromSession() };
    if (!session?.user?.tenantId) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    const tenantId = session.user.tenantId;
    const { searchParams } = new URL(request.url);
    const kind = String(searchParams.get('kind') || 'SITE').toUpperCase();
    const environment = searchParams.get('environment') || 'SANDBOX';
    const where = { tenantId, businessId: tenantId, environment };

    let data;
    if (kind === 'TAX') data = await prisma.mraEisTaxMapping.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 200 });
    else if (kind === 'LEVY') data = await prisma.mraEisLevyMapping.findMany({ where: { tenantId, businessId: tenantId }, orderBy: { updatedAt: 'desc' }, take: 200 });
    else if (kind === 'PAYMENT') data = await prisma.mraEisPaymentMethodMapping.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 200 });
    else data = await prisma.mraEisSiteMapping.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 200 });

    return eisJson({ success: true, data, requestId: readRequestId(request) });
  } catch (err) {
    return eisErrorResponse(err);
  }
}

export async function POST(request) {
  try {
    const session = { user: await getUserFromSession() };
    if (!session?.user?.tenantId) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    const body = await request.json();
    const tenantId = session.user.tenantId;
    const kind = String(body.kind || 'SITE').toUpperCase();
    const environment = body.environment || 'SANDBOX';

    // Browser cannot force ACTIVE
    const status = body.status === MAPPING_STATUS.ACTIVE ? MAPPING_STATUS.MATCHED : (body.status || MAPPING_STATUS.MATCHED);

    let row;
    if (kind === 'SITE') {
      row = await createSiteMapping({
        tenantId,
        businessId: tenantId,
        branchId: body.branchId,
        mraSiteId: body.mraSiteId,
        warehouseId: body.warehouseId || null,
        terminalId: body.terminalId || null,
        environment,
        status,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
        verifiedBy: session.user.id,
      });
    } else if (kind === 'TAX') {
      row = await createTaxMapping({
        tenantId,
        businessId: tenantId,
        localTaxRateId: body.localTaxRateId,
        mraTaxRateId: body.mraTaxRateId,
        externalTaxDefinitionId: body.externalTaxDefinitionId || null,
        localRateSnapshot: body.localRateSnapshot ?? 0,
        mraRateSnapshot: body.mraRateSnapshot ?? 0,
        treatmentType: body.treatmentType || null,
        environment,
        status,
        verifiedBy: session.user.id,
      });
    } else if (kind === 'PAYMENT') {
      row = await createPaymentMethodMapping({
        tenantId,
        businessId: tenantId,
        localPaymentMethodId: body.localPaymentMethodId,
        mraPaymentMethodCode: body.mraPaymentMethodCode,
        environment,
        status,
        verifiedBy: session.user.id,
      });
    } else if (kind === 'LEVY') {
      row = await createLevyMapping({
        tenantId,
        businessId: tenantId,
        localLevyId: body.localLevyId,
        mraLevyId: body.mraLevyId,
        status: MAPPING_STATUS.MATCHED,
        verifiedBy: session.user.id,
      });
    } else {
      throw EisErrors.validation({ message: `Unsupported mapping kind ${kind}` });
    }

    return eisJson({ success: true, data: row, requestId: readRequestId(request) });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
