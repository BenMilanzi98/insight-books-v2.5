import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';
import { adminHasEisPermission, SYSTEM_EIS_PERMISSIONS } from '@/lib/mraEis/domain/permissions.js';
import { MAPPING_STATUS } from '@/lib/mraEis/domain/operationalEnums.js';

/**
 * System Administration mapping health across tenants (metadata only — no credentials).
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    if (
      !adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.MAPPINGS_VIEW) &&
      !adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.VIEW)
    ) {
      throw EisErrors.permissionDenied({ message: 'System mapping view denied.' });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || undefined;
    const environment = searchParams.get('environment') || undefined;
    const status = searchParams.get('status') || undefined;
    const kind = String(searchParams.get('kind') || 'SITE').toUpperCase();

    const model =
      kind === 'TAX'
        ? 'mraEisTaxMapping'
        : kind === 'LEVY'
          ? 'mraEisLevyMapping'
          : kind === 'PAYMENT'
            ? 'mraEisPaymentMethodMapping'
            : kind === 'PRODUCT' || kind === 'SERVICE'
              ? 'mraEisProductMapping'
              : 'mraEisSiteMapping';

    const where = {
      ...(tenantId ? { tenantId } : {}),
      ...(environment && kind !== 'PRODUCT' && kind !== 'SERVICE' ? { environment } : {}),
      ...(status ? { status } : {}),
      ...(kind === 'PRODUCT' ? { localItemId: { not: null } } : {}),
      ...(kind === 'SERVICE' ? { localServiceId: { not: null } } : {}),
    };

    if (typeof prisma[model]?.findMany !== 'function') {
      throw new Error(`Mapping model unavailable: ${model}`);
    }

    const rows = await prisma[model].findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    const [stale, conflict, pendingApproval, active] = await Promise.all([
      prisma[model].count({ where: { ...where, status: MAPPING_STATUS.STALE } }),
      prisma[model].count({ where: { ...where, status: MAPPING_STATUS.CONFLICT } }),
      prisma[model].count({ where: { ...where, status: MAPPING_STATUS.PENDING_APPROVAL } }),
      prisma[model].count({ where: { ...where, status: MAPPING_STATUS.ACTIVE } }),
    ]);

    return eisJson({
      success: true,
      data: {
        kind,
        rows,
        health: { stale, conflict, pendingApproval, active },
        note: 'Read-only diagnostics. Historical mappings are immutable. No credentials.',
      },
      requestId: readRequestId(request),
    });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
