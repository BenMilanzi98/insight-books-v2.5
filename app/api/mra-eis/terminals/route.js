import { getUserFromSession } from '@/lib/auth';
import prisma from '@/lib/prisma.js';
import { createTerminalForOnboarding, safeTerminalDto } from '@/lib/mraEis/application/activation/activationOrchestrator.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';
import { tenantHasEisPermission, TENANT_EIS_PERMISSIONS } from '@/lib/mraEis/domain/permissions.js';
import { checkActivationRateLimit } from '@/lib/mraEis/application/activation/rateLimit.js';

export async function GET(request) {
  try {
    const user = await getUserFromSession();
    if (!user?.tenantId) {
      throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    }
    if (!tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.TERMINAL_VIEW)) {
      throw EisErrors.permissionDenied();
    }
    const rows = await prisma.mraEisTerminal.findMany({
      where: { tenantId: user.tenantId, businessId: user.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
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

export async function POST(request) {
  try {
    const user = await getUserFromSession();
    if (!user?.tenantId) {
      throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    }
    if (!tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.TERMINAL_CREATE)) {
      throw EisErrors.permissionDenied();
    }
    const rl = checkActivationRateLimit({
      action: 'create',
      tenantId: user.tenantId,
      businessId: user.tenantId,
      userId: user.id,
      limit: 20,
    });
    if (!rl.allowed) {
      throw EisErrors.validation({ message: 'Rate limit exceeded for terminal creation.' });
    }
    const body = await request.json();
    const result = await createTerminalForOnboarding({
      tenantId: user.tenantId,
      businessId: user.tenantId,
      branchId: body.branchId || null,
      environment: body.environment || 'SANDBOX',
      terminalLabel: body.terminalLabel,
      scopeType: body.scopeType,
      idempotencyKey: request.headers.get('idempotency-key') || body.idempotencyKey,
      createdBy: user.id,
    });
    return eisJson({
      success: true,
      data: result,
      requestId: readRequestId(request),
    });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
