import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';
import { adminHasEisPermission, SYSTEM_EIS_PERMISSIONS } from '@/lib/mraEis/domain/permissions.js';
import { safeTerminalDto } from '@/lib/mraEis/application/activation/activationOrchestrator.js';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    if (
      !adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.TERMINALS_VIEW) &&
      !adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.VIEW)
    ) {
      throw EisErrors.permissionDenied();
    }

    const { searchParams } = new URL(request.url);
    const where = {};
    if (searchParams.get('tenantId')) where.tenantId = searchParams.get('tenantId');
    if (searchParams.get('businessId')) where.businessId = searchParams.get('businessId');
    if (searchParams.get('environment')) where.environment = searchParams.get('environment');
    if (searchParams.get('status')) where.status = searchParams.get('status');
    if (searchParams.get('manualReview') === '1') {
      where.status = {
        in: ['MANUAL_REVIEW', 'UNKNOWN_ACTIVATION_OUTCOME', 'UNKNOWN_CONFIRMATION_OUTCOME'],
      };
    }
    if (searchParams.get('tokenExpired') === '1') {
      where.OR = [{ status: 'TOKEN_EXPIRED' }, { tokenExpiresAt: { lt: new Date() } }];
    }

    const rows = await prisma.mraEisTerminal.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: Math.min(Number(searchParams.get('limit') || 100), 200),
    });

    return eisJson({
      success: true,
      data: rows.map(safeTerminalDto),
      requestId: readRequestId(request),
    });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
