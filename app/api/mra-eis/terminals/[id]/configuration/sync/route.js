import { getUserFromSession } from '@/lib/auth';
import { runConfigurationSyncNow } from '@/lib/mraEis/application/configuration/configurationSyncOrchestrator.js';
import { CONFIG_SYNC_TRIGGER } from '@/lib/mraEis/domain/operationalEnums.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';
import { tenantHasEisPermission, TENANT_EIS_PERMISSIONS } from '@/lib/mraEis/domain/permissions.js';
import { checkActivationRateLimit } from '@/lib/mraEis/application/activation/rateLimit.js';

export async function POST(request, { params }) {
  try {
    const user = await getUserFromSession();
    if (!user?.tenantId) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    if (!tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.CONFIGURATION_SYNC)) {
      throw EisErrors.permissionDenied();
    }
    const rl = checkActivationRateLimit({
      action: 'config-sync',
      tenantId: user.tenantId,
      userId: user.id,
      terminalId: params.id,
      limit: 10,
    });
    if (!rl.allowed) {
      throw EisErrors.validation({ message: 'Rate limit exceeded for configuration sync.' });
    }
    const body = await request.json().catch(() => ({}));
    const result = await runConfigurationSyncNow({
      tenantId: user.tenantId,
      businessId: user.tenantId,
      terminalId: params.id,
      trigger: body.trigger || CONFIG_SYNC_TRIGGER.MANUAL,
      reason: body.reason || 'Manual configuration synchronization',
      requestedBy: user.id,
      scenario: body.scenario || null,
      idempotencyKey: request.headers.get('idempotency-key') || body.idempotencyKey || null,
    });
    return eisJson({ success: true, data: result, requestId: readRequestId(request) });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
