import { getUserFromSession } from '@/lib/auth';
import { getConfigurationHealth } from '@/lib/mraEis/application/configuration/configurationHealthService.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';
import { tenantHasEisPermission, TENANT_EIS_PERMISSIONS } from '@/lib/mraEis/domain/permissions.js';
import prisma from '@/lib/prisma.js';

export async function GET(request, { params }) {
  try {
    const user = await getUserFromSession();
    if (!user?.tenantId) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    if (
      !tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.CONFIGURATION_HEALTH_VIEW) &&
      !tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.CONFIGURATION_VIEW)
    ) {
      throw EisErrors.permissionDenied();
    }
    const health = await getConfigurationHealth({
      tenantId: user.tenantId,
      businessId: user.tenantId,
      terminalId: params.id,
    });
    if (!health) throw EisErrors.terminalNotFound({ tenantId: user.tenantId });

    const snapshots = await prisma.mraEisConfigurationSnapshot.findMany({
      where: { terminalId: params.id, tenantId: user.tenantId, businessId: user.tenantId },
      orderBy: { receivedAt: 'desc' },
      take: 30,
      select: {
        id: true,
        configurationType: true,
        mraVersion: true,
        status: true,
        sourceChecksum: true,
        receivedAt: true,
        activatedAt: true,
        supersededAt: true,
        effectiveFrom: true,
      },
    });

    return eisJson({
      success: true,
      data: { health, snapshots },
      requestId: readRequestId(request),
    });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
