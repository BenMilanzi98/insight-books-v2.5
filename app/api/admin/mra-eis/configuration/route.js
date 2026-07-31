import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';
import { adminHasEisPermission, SYSTEM_EIS_PERMISSIONS } from '@/lib/mraEis/domain/permissions.js';
import { evaluateConfigurationFreshness } from '@/lib/mraEis/application/configuration/stalenessService.js';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    if (
      !adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.CONFIGURATION_VIEW) &&
      !adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.VIEW)
    ) {
      throw EisErrors.permissionDenied();
    }

    const { searchParams } = new URL(request.url);
    const where = {};
    if (searchParams.get('tenantId')) where.tenantId = searchParams.get('tenantId');
    if (searchParams.get('environment')) where.environment = searchParams.get('environment');
    if (searchParams.get('status')) where.status = searchParams.get('status');

    const terminals = await prisma.mraEisTerminal.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: Math.min(Number(searchParams.get('limit') || 50), 100),
    });

    const rows = [];
    for (const t of terminals) {
      const freshness = await evaluateConfigurationFreshness({
        tenantId: t.tenantId,
        businessId: t.businessId,
        terminalId: t.id,
      }).catch(() => null);
      rows.push({
        terminalId: t.id,
        tenantId: t.tenantId,
        businessId: t.businessId,
        environment: t.environment,
        status: t.status,
        terminalLabel: t.terminalLabel,
        lastConfigurationSyncAt: t.lastConfigurationSyncAt,
        freshnessStatus: freshness?.status || null,
        processingPaused: freshness?.processingPaused || false,
        activeVersions: freshness?.activeVersions || null,
      });
    }

    return eisJson({ success: true, data: rows, requestId: readRequestId(request) });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
