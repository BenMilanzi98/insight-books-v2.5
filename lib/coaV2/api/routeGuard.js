/**
 * CoA V2 — shared API route guard.
 *
 * Centralizes for every /api/coa-v2 route:
 *  - session authentication (tenant always taken from the session, never the client);
 *  - server-side permission check (granular coa.* keys via the existing framework);
 *  - AccountingContext construction;
 *  - typed AccountingV2Error → safe JSON response mapping.
 */

import { NextResponse } from 'next/server';
import { getUserFromSession, hasPermission } from '../../auth.js';
import { contextFromSessionUser } from '../../accountingV2/domain/accountingContext.js';
import { AccountingV2Error } from '../../accountingV2/domain/errors.js';

/**
 * Authenticate the request and authorize one of the given permissions.
 * @param {Request} request
 * @param {string|string[]} permissions permission key(s); any one grants access
 * @returns {Promise<{user: object, context: object}|{response: Response}>}
 */
export async function guardCoaRoute(request, permissions) {
  const user = await getUserFromSession(request);
  if (!user || !user.tenantId) {
    return {
      response: NextResponse.json(
        { error: 'Authentication required or no business associated' },
        { status: 401 }
      ),
    };
  }
  const keys = Array.isArray(permissions) ? permissions : [permissions];
  const allowed = keys.some((key) => hasPermission(user, key));
  if (!allowed) {
    return {
      response: NextResponse.json(
        { error: `Access denied. Required permission: ${keys.join(' or ')}` },
        { status: 403 }
      ),
    };
  }
  const context = contextFromSessionUser(user, {
    branchId: user.currentBranchId ?? null,
    permissions: keys,
  });
  return { user, context };
}

/**
 * Map errors to responses: typed accounting errors return their safe JSON and
 * status; everything else is a logged 500 without internal detail.
 * @param {unknown} error
 * @param {string} operation label for server logs
 */
export function coaErrorResponse(error, operation) {
  if (error instanceof AccountingV2Error) {
    return NextResponse.json(error.toSafeJSON(), { status: error.httpStatus });
  }
  console.error(`[coaV2] ${operation} failed`, error);
  return NextResponse.json(
    { error: 'INTERNAL_ERROR', message: `Failed to ${operation}` },
    { status: 500 }
  );
}
