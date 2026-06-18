import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { resolveReportTenantScope } from '@/lib/reportTenantScope';
import { logReportAccess } from '@/lib/reportAuditLog';

/**
 * Standard auth + tenant scope bootstrap for report GET handlers.
 * @returns {Promise<
 *   | { error: NextResponse }
 *   | {
 *       user: object,
 *       tenantIds: string[],
 *       tenants: object[],
 *       scope: object,
 *       tw: object,
 *       userQ: object,
 *       branchId: string|null,
 *       branchScoped: boolean,
 *       primaryTenantId: string,
 *       reportBranchId: string|null,
 *     }
 * >}
 */
export async function bootstrapReportRoute(request) {
  const user = await getUserFromSession(request);
  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      ),
    };
  }

  const scopeResult = await resolveReportTenantScope(request, user);
  if (!scopeResult.ok) {
    return {
      error: NextResponse.json(
        { error: scopeResult.error },
        { status: scopeResult.status }
      ),
    };
  }

  const primaryTenantId = scopeResult.tenantIds[0];
  const reportBranchId = scopeResult.branchScoped ? scopeResult.branchId : null;

  return {
    user,
    ...scopeResult,
    primaryTenantId,
    reportBranchId,
  };
}

/**
 * Log report access (non-blocking for handler).
 */
export async function auditReportAccess({
  user,
  reportType,
  tenantIds,
  scope,
  filters = {},
  format = null,
}) {
  await logReportAccess({
    userId: user.id,
    tenantId: tenantIds[0],
    reportType,
    action: format ? 'REPORT_EXPORTED' : 'REPORT_GENERATED',
    tenantIds,
    businessNames: scope?.businessNames,
    filters,
    format,
  });
}

/**
 * Attach tenant name to rows when multiple businesses are in scope.
 */
export function attachBusinessName(rows, tenantNameField = 'businessName') {
  return rows;
}

export function enrichRowsWithTenantName(rows, tenantIdToName) {
  if (!rows?.length || !tenantIdToName?.size) return rows;
  return rows.map((row) => {
    const tid = row.tenantId;
    if (!tid || row.businessName) return row;
    return { ...row, businessName: tenantIdToName.get(tid) || tid };
  });
}

export function tenantNameMap(tenants) {
  return new Map((tenants || []).map((t) => [t.id, t.name]));
}
