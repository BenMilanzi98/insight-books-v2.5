import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { adminHasEisPermission, SYSTEM_EIS_PERMISSIONS } from '@/lib/mraEis/domain/permissions.js';
import { ENTITLEMENT_STATUS } from '@/lib/mraEis/domain/constants.js';
import {
  resolveEisAdminContext,
  buildContextBarModel,
  SYSTEM_EIS_ADMIN_SECTIONS,
  aggregatePlatformEisOverview,
} from '@/lib/mraEis';
import { eisErrorResponse, eisJson, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

async function safeCount(label, fn, counts, loadErrors) {
  try {
    counts[label] = await fn();
  } catch {
    loadErrors[label] = 'QUERY_FAILED';
  }
}

/**
 * GET — Platform EIS Administration Centre overview (system admin session).
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      throw EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' });
    }
    if (
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.mraEntitlement.view) &&
      !adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.VIEW)
    ) {
      throw EisErrors.permissionDenied();
    }

    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment') || 'PRODUCTION';

    const context = resolveEisAdminContext({
      user: {
        id: admin.id,
        email: admin.email,
        isSystemAdmin: true,
        isSuperAdmin: admin.role === 'Super Admin',
        role: 'SYSTEM_ADMINISTRATOR',
      },
      environment,
    });

    const counts = {};
    const loadErrors = {};

    await Promise.all([
      safeCount(
        'entitledTenants',
        () =>
          prisma.mraEisTenantEntitlement.count({
            where: {
              isCurrent: true,
              status: {
                in: [
                  ENTITLEMENT_STATUS.ENTITLED_SANDBOX_ONLY,
                  ENTITLEMENT_STATUS.ENTITLED_PRODUCTION,
                ],
              },
            },
          }),
        counts,
        loadErrors
      ),
      safeCount(
        'productionBusinesses',
        () =>
          prisma.mraEisTenantEntitlement.count({
            where: {
              isCurrent: true,
              status: ENTITLEMENT_STATUS.ENTITLED_PRODUCTION,
              productionAllowed: true,
            },
          }),
        counts,
        loadErrors
      ),
      safeCount(
        'sandboxBusinesses',
        () =>
          prisma.mraEisTenantEntitlement.count({
            where: {
              isCurrent: true,
              status: ENTITLEMENT_STATUS.ENTITLED_SANDBOX_ONLY,
            },
          }),
        counts,
        loadErrors
      ),
      safeCount(
        'activeTerminals',
        () =>
          prisma.mraEisTerminal.count({
            where: {
              status: { in: ['ACTIVE', 'ACTIVATED', 'READY'] },
              ...(environment ? { environment } : {}),
            },
          }),
        counts,
        loadErrors
      ),
      safeCount(
        'blockedTerminals',
        () =>
          prisma.mraEisTerminal.count({
            where: {
              status: { in: ['BLOCKED', 'SUSPENDED', 'REVOKED'] },
              ...(environment ? { environment } : {}),
            },
          }),
        counts,
        loadErrors
      ),
      safeCount(
        'pendingTransmissions',
        () =>
          prisma.mraEisTransmission.count({
            where: {
              state: { in: ['READY', 'QUEUED', 'DISPATCHING', 'SUBMITTING'] },
            },
          }),
        counts,
        loadErrors
      ),
      safeCount(
        'manualReviewBacklog',
        () =>
          prisma.mraEisManualReviewCase.count({
            where: { status: { in: ['OPEN', 'ASSIGNED'] } },
          }),
        counts,
        loadErrors
      ),
    ]);

    // Optional tables — leave as failed rather than fake zero if model missing
    if (typeof prisma.mraEisTrustedAgent?.count === 'function') {
      await safeCount(
        'activeAgents',
        () => prisma.mraEisTrustedAgent.count({ where: { lifecycleState: 'ACTIVE' } }),
        counts,
        loadErrors
      );
    } else {
      counts.activeAgents = 0;
    }

    if (typeof prisma.mraEisRestriction?.count === 'function') {
      await safeCount(
        'activeRestrictions',
        () =>
          prisma.mraEisRestriction.count({
            where: {
              state: { in: ['ACTIVE', 'ACKNOWLEDGED', 'UNBLOCK_REQUEST_PENDING'] },
            },
          }),
        counts,
        loadErrors
      );
    } else {
      counts.activeRestrictions = 0;
    }

    for (const key of [
      'unknownOutcomes',
      'certificationExpirations',
      'openIncidents',
    ]) {
      if (counts[key] === undefined && !loadErrors[key]) counts[key] = 0;
    }

    const overview = aggregatePlatformEisOverview({
      context,
      counts,
      loadErrors,
      projectionUpdatedAt: new Date().toISOString(),
    });

    return eisJson({
      success: true,
      context: buildContextBarModel(context, {
        dataFreshness: overview.freshness,
        platformEisStatus: 'AVAILABLE',
      }),
      overview,
      sections: SYSTEM_EIS_ADMIN_SECTIONS,
      requestId: readRequestId(request),
    });
  } catch (err) {
    return eisErrorResponse(err);
  }
}
