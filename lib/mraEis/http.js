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

export function readRequestId(body, request) {
  return (
    body?.requestId ||
    request.headers.get('x-request-id') ||
    request.headers.get('idempotency-key') ||
    null
  );
}
