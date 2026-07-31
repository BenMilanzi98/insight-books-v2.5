import { getUserFromSession } from '@/lib/auth';
import prisma from '@/lib/prisma.js';
import { classifyBusinessEisType } from '@/lib/mraEis/application/catalogue/businessTypeClassification.js';
import { calculateProductServiceCompleteness } from '@/lib/mraEis/application/catalogue/productServiceCompleteness.js';
import {
  getProductSyncContractDecision,
  getServiceSyncContractDecision,
  getInitialInventoryContractDecision,
} from '@/lib/mraEis/application/catalogue/productSyncContract.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

export async function GET(request) {
  try {
    const session = { user: await getUserFromSession() };
    if (!session?.user?.tenantId) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    const tenantId = session.user.tenantId;
    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment') || 'SANDBOX';
    const externalType = searchParams.get('externalType'); // PRODUCT | SERVICE

    const [businessType, completeness, items, mappings] = await Promise.all([
      classifyBusinessEisType({ tenantId, businessId: tenantId, environment }),
      calculateProductServiceCompleteness({ tenantId, businessId: tenantId, environment }),
      prisma.mraEisExternalCatalogueItem.findMany({
        where: {
          tenantId,
          businessId: tenantId,
          environment,
          supersededAt: null,
          ...(externalType ? { externalType } : {}),
        },
        orderBy: { synchronizedAt: 'desc' },
        take: 200,
      }),
      prisma.mraEisProductMapping.findMany({
        where: { tenantId, businessId: tenantId },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      }),
    ]);

    return eisJson({
      success: true,
      data: {
        businessType,
        completeness,
        items,
        mappings,
        contracts: {
          product: getProductSyncContractDecision(),
          service: getServiceSyncContractDecision(),
          initialInventory: getInitialInventoryContractDecision(),
        },
      },
      requestId: readRequestId(request),
    });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
