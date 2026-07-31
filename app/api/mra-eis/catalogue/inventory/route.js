import { getUserFromSession } from '@/lib/auth';
import {
  evaluateInitialMraInventoryRequirement,
  reconcileOpeningInventoryReadOnly,
  createInitialInventorySnapshot,
  approveInitialInventorySnapshot,
  submitInitialInventorySnapshot,
} from '@/lib/mraEis/application/catalogue/initialInventory.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

export async function GET(request) {
  try {
    const session = { user: await getUserFromSession() };
    if (!session?.user?.tenantId) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    const { searchParams } = new URL(request.url);
    const data = await evaluateInitialMraInventoryRequirement({
      tenantId: session.user.tenantId,
      businessId: session.user.tenantId,
      terminalId: searchParams.get('terminalId'),
      environment: searchParams.get('environment') || 'SANDBOX',
    });
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
    const action = String(body.action || 'reconcile').toLowerCase();
    const environment = body.environment || 'SANDBOX';

    if (action === 'reconcile') {
      const data = await reconcileOpeningInventoryReadOnly({
        tenantId,
        businessId: tenantId,
        warehouseId: body.warehouseId,
        cutoffTimestamp: body.cutoffTimestamp ? new Date(body.cutoffTimestamp) : new Date(),
        environment,
      });
      return eisJson({ success: true, data, requestId: readRequestId(request) });
    }
    if (action === 'snapshot') {
      const data = await createInitialInventorySnapshot({
        tenantId,
        businessId: tenantId,
        warehouseId: body.warehouseId,
        terminalId: body.terminalId,
        siteMappingId: body.siteMappingId,
        cutoffTimestamp: body.cutoffTimestamp ? new Date(body.cutoffTimestamp) : new Date(),
        createdBy: session.user.id,
        environment,
      });
      return eisJson({ success: true, data, requestId: readRequestId(request) });
    }
    if (action === 'approve') {
      const data = await approveInitialInventorySnapshot({
        snapshot: body.snapshot,
        approvedBy: session.user.id,
      });
      return eisJson({ success: true, data, requestId: readRequestId(request) });
    }
    if (action === 'submit') {
      const data = await submitInitialInventorySnapshot({
        tenantId,
        businessId: tenantId,
        snapshot: body.snapshot,
        approvedBy: session.user.id,
        environment,
        idempotencyKey: request.headers.get('idempotency-key') || body.idempotencyKey,
      });
      return eisJson({ success: true, data, requestId: readRequestId(request) });
    }
    throw EisErrors.validation({ message: `Unsupported inventory action ${action}` });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
