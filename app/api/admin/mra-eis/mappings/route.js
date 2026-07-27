import { getUserFromSession } from '@/lib/auth';
import prisma from '@/lib/prisma.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';
import { MAPPING_STATUS } from '@/lib/mraEis/domain/operationalEnums.js';

/**
 * System Administration mapping health across tenants (metadata only — no credentials).
 */
export async function GET(request) {
  try {
    const session = { user: await getUserFromSession() };
    if (!session?.user) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    // Platform admin gate — mirror other admin EIS routes
    if (!session.user.isSystemAdmin && session.user.role !== 'SYSTEM_ADMIN' && !session.user.platformAdmin) {
      // Allow if tenant admin inspecting own via filter; otherwise require system role
      const isAdmin = Boolean(session.user.isAdmin || session.user.role === 'ADMIN');
      if (!isAdmin) throw EisErrors.permissionDenied({ message: 'System mapping view denied.' });
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

    const supportsEnvironment = !['PRODUCT', 'SERVICE', 'LEVY'].includes(kind) || kind === 'LEVY';
    const where = {
      ...(tenantId ? { tenantId } : {}),
      ...(environment && kind !== 'PRODUCT' && kind !== 'SERVICE' ? { environment } : {}),
      ...(status ? { status } : {}),
      ...(kind === 'PRODUCT' ? { localItemId: { not: null } } : {}),
      ...(kind === 'SERVICE' ? { localServiceId: { not: null } } : {}),
    };
    void supportsEnvironment;

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
