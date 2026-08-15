import { serviceError } from '@/lib/serviceErrors';

/**
 * Invoke an existing App Router handler in-process with a different JSON body.
 *
 * Used by the desktop outbox for flows whose implementation still lives inside a
 * large route handler (invoice update / payments / stock). Replaying the queued
 * payload through the real handler keeps a single posting path instead of
 * duplicating accounting or validation logic in a second place.
 *
 * Auth still resolves normally: session cookies come from the ambient request
 * scope, and the caller's cookie/authorization headers are forwarded.
 */
export async function callRouteHandler({
  handler,
  request,
  method = 'POST',
  path,
  body,
  params = null,
}) {
  if (typeof handler !== 'function') {
    throw serviceError(`No handler available for ${method} ${path}`, { status: 500 });
  }
  if (!request) {
    throw serviceError(`${method} ${path} needs the originating request context`, {
      status: 500,
      code: 'REQUEST_CONTEXT_REQUIRED',
    });
  }

  const url = new URL(path, request.url || 'http://localhost');
  const headers = new Headers();
  headers.set('content-type', 'application/json');
  for (const key of ['cookie', 'authorization', 'x-forwarded-for', 'x-real-ip', 'user-agent']) {
    const value = request.headers?.get(key);
    if (value) headers.set(key, value);
  }

  const innerRequest = new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body ?? {}),
  });

  const response = await handler(
    innerRequest,
    params ? { params: Promise.resolve(params) } : { params: Promise.resolve({}) }
  );

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw serviceError(payload?.error || `${method} ${path} failed`, {
      status: response.status,
      code: payload?.code,
      body: payload ?? { error: `${method} ${path} failed` },
    });
  }

  return payload;
}
