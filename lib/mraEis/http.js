import { NextResponse } from 'next/server';
import { isMraEisControlError } from './domain/errors.js';

export function eisJson(data, init = {}) {
  return NextResponse.json({ success: true, ...data }, init);
}

export function eisErrorResponse(err) {
  if (isMraEisControlError(err)) {
    return NextResponse.json(err.toJSON(), { status: err.httpStatus || 400 });
  }
  console.error('[mra-eis]', err);
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected EIS control error occurred.',
      },
    },
    { status: 500 }
  );
}

export function requestMeta(request) {
  return {
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
    userAgent: request.headers.get('user-agent') || null,
  };
}

/**
 * Resolve request/idempotency id from a JSON body and/or Request.
 * Supports both call styles used across routes:
 *   readRequestId(request)
 *   readRequestId(body, request)
 */
export function readRequestId(bodyOrRequest, maybeRequest) {
  const isRequestLike = (v) =>
    Boolean(v && typeof v === 'object' && typeof v.headers?.get === 'function');

  let body = bodyOrRequest;
  let request = maybeRequest;
  if (isRequestLike(bodyOrRequest) && maybeRequest == null) {
    request = bodyOrRequest;
    body = null;
  } else if (isRequestLike(bodyOrRequest) && isRequestLike(maybeRequest)) {
    // Defensive: first arg was accidentally a Request
    request = bodyOrRequest;
    body = null;
  }

  return (
    body?.requestId ||
    request?.headers?.get('x-request-id') ||
    request?.headers?.get('idempotency-key') ||
    null
  );
}
