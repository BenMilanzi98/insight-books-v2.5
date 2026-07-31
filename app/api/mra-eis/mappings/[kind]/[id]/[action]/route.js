import { getUserFromSession } from '@/lib/auth';
import {
  verifyMapping,
  approveMapping,
  activateMapping,
  supersedeMapping,
} from '@/lib/mraEis/application/mapping/mappingLifecycle.js';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

const KINDS = new Set(['SITE', 'TAX', 'LEVY', 'PAYMENT', 'PRODUCT', 'SERVICE']);

export async function POST(request, { params }) {
  try {
    const session = { user: await getUserFromSession() };
    if (!session?.user?.tenantId) throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    const { kind: rawKind, id, action: rawAction } = await params;
    const kind = String(rawKind || '').toUpperCase();
    const action = String(rawAction || '').toLowerCase();
    if (!KINDS.has(kind)) throw EisErrors.validation({ message: 'Invalid mapping kind' });

    const body = await request.json().catch(() => ({}));
    const tenantId = session.user.tenantId;
    const environment = body.environment || 'SANDBOX';
    const requireApproval = String(environment).toUpperCase() === 'PRODUCTION';

    let data;
    if (action === 'verify') {
      data = await verifyMapping({
        tenantId,
        businessId: tenantId,
        kind,
        mappingId: id,
        verifiedBy: session.user.id,
        expectedVersion: body.expectedVersion,
      });
    } else if (action === 'approve') {
      data = await approveMapping({
        tenantId,
        businessId: tenantId,
        kind,
        mappingId: id,
        approvedBy: session.user.id,
        approvalId: body.approvalId || null,
        expectedVersion: body.expectedVersion,
      });
    } else if (action === 'activate') {
      data = await activateMapping({
        tenantId,
        businessId: tenantId,
        kind,
        mappingId: id,
        activatedBy: session.user.id,
        environment,
        requireApproval,
        reason: body.reason || null,
        expectedVersion: body.expectedVersion,
      });
    } else if (action === 'supersede') {
      data = await supersedeMapping({
        tenantId,
        businessId: tenantId,
        kind,
        previousMappingId: id,
        newMappingId: body.newMappingId,
        actorId: session.user.id,
        reason: body.reason,
      });
    } else {
      throw EisErrors.validation({ message: `Unsupported action ${action}` });
    }

    return eisJson({ success: true, data, requestId: readRequestId(request) });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
