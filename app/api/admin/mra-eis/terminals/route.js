import { getUserFromSession, hasPermission } from '@/lib/auth';
import prisma from '@/lib/prisma.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';
import { adminHasEisPermission, SYSTEM_EIS_PERMISSIONS } from '@/lib/mraEis/domain/permissions.js';
import { safeTerminalDto } from '@/lib/mraEis/application/activation/activationOrchestrator.js';

export async function GET(request) {
  try {
    const user = await getUserFromSession();
    if (!user) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    const allowed =
      adminHasEisPermission(user, SYSTEM_EIS_PERMISSIONS.TERMINALS_VIEW) ||
      adminHasEisPermission(user, SYSTEM_EIS_PERMISSIONS.VIEW) ||
      hasPermission(user, 'admin.access') ||
      user.role === 'Super Admin' ||
      String(user.role?.name || '').toLowerCase().includes('admin');
    if (!allowed) throw EisErrors.permissionDenied();

    const { searchParams } = new URL(request.url);
    const where = {};
    if (searchParams.get('tenantId')) where.tenantId = searchParams.get('tenantId');
    if (searchParams.get('businessId')) where.businessId = searchParams.get('businessId');
    if (searchParams.get('environment')) where.environment = searchParams.get('environment');
    if (searchParams.get('status')) where.status = searchParams.get('status');
    if (searchParams.get('manualReview') === '1') {
      where.status = { in: ['MANUAL_REVIEW', 'UNKNOWN_ACTIVATION_OUTCOME', 'UNKNOWN_CONFIRMATION_OUTCOME'] };
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
