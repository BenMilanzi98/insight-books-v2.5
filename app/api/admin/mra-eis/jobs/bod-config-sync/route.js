import { getUserFromSession, hasPermission } from '@/lib/auth';
import { queueBeginningOfDayConfigurationSyncs } from '@/lib/mraEis/application/configuration/bodScheduler.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';
import { adminHasEisPermission, SYSTEM_EIS_PERMISSIONS } from '@/lib/mraEis/domain/permissions.js';

/** Durable BOD job entrypoint — queues Sync Runs; does not fan-out execute all terminals. */
export async function POST(request) {
  try {
    const user = await getUserFromSession();
    if (!user) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    const allowed =
      adminHasEisPermission(user, SYSTEM_EIS_PERMISSIONS.CONFIGURATION_SYNC) ||
      hasPermission(user, 'admin.access') ||
      user.role === 'Super Admin';
    if (!allowed) throw EisErrors.permissionDenied();

    const body = await request.json().catch(() => ({}));
    const result = await queueBeginningOfDayConfigurationSyncs({
      limit: Math.min(Number(body.limit || 50), 200),
    });
    return eisJson({ success: true, data: result, requestId: readRequestId(request) });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
