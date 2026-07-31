/**
 * Accounting V2 — shared API route guard for /api/accounting-v2 routes.
 *
 * Centralizes:
 *  - session authentication (business always from the session, never the client);
 *  - server-side permission checks via the existing framework;
 *  - AccountingContext construction with request/correlation identifiers;
 *  - a bound `hasPermission(key)` callback for the engine and services;
 *  - typed AccountingV2Error → safe JSON response mapping (no stack traces).
 */

import { NextResponse } from 'next/server';
import { getUserFromSession, hasPermission } from '../../auth.js';
import { contextFromSessionUser } from '../domain/accountingContext.js';
import { AccountingV2Error } from '../domain/errors.js';
import { logAccountingError } from '../observability/accountingLogger.js';

/**
 * Authenticate and authorize. `permissions` may be a single key or a list —
 * any one grants access. Returns `{response}` on refusal.
 * @param {Request} request
 * @param {string|string[]} permissions
 */
export async function guardAccountingRoute(request, permissions) {
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
    requestId: request.headers.get('x-request-id') ?? undefined,
    correlationId: request.headers.get('x-correlation-id') ?? undefined,
  });
  // Permission callback bound to the SESSION user — services and the engine
  // re-check granular keys through this, never through client input.
  const can = (key) => hasPermission(user, key);
  return { user, context, can };
}

/**
 * Map errors to safe responses. Typed accounting errors serialize their safe
 * JSON at their HTTP status; anything else is logged and returned as 500.
 * @param {unknown} error
 * @param {string} operation
 */
export function accountingErrorResponse(error, operation) {
  if (error instanceof AccountingV2Error) {
    logAccountingError(error, { operation });
    return NextResponse.json(error.toSafeJSON(), { status: error.httpStatus });
  }
  console.error(`[accountingV2] ${operation} failed`, error);
  return NextResponse.json(
    { error: 'INTERNAL_ERROR', message: `Failed to ${operation}` },
    { status: 500 }
  );
}
