/**
 * Error type shared by service functions extracted out of API routes.
 *
 * Routes re-render `error.body` with `error.status` so the HTTP contract is
 * unchanged after an extraction; non-HTTP callers (desktop outbox apply) read
 * `error.message` / `error.code`.
 */
export class ServiceHttpError extends Error {
  constructor(message, { status = 400, code, body, details } = {}) {
    super(message);
    this.name = 'ServiceHttpError';
    this.status = status;
    if (code) this.code = code;
    if (details !== undefined) this.details = details;
    this.body =
      body ?? {
        error: message,
        ...(code ? { code } : {}),
        ...(details !== undefined ? { details } : {}),
      };
  }
}

export function serviceError(message, options) {
  return new ServiceHttpError(message, options);
}

export function isServiceHttpError(error) {
  return error instanceof ServiceHttpError;
}
