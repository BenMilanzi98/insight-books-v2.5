import { describe, it, expect } from 'vitest';
import { classifyApiError } from '../lib/apiErrorUtils.js';

describe('classifyApiError', () => {
  it('maps P2028 transaction timeout to 503', () => {
    const r = classifyApiError({ code: 'P2028', message: 'Transaction already closed' });
    expect(r.status).toBe(503);
    expect(r.error).toMatch(/timed out/i);
  });

  it('maps period lock to 403', () => {
    const r = classifyApiError({ code: 'PERIOD_LOCKED', message: 'Period closed' });
    expect(r.status).toBe(403);
  });

  it('returns real message in production for unknown errors', () => {
    const r = classifyApiError(new Error('Accounts Receivable account not found and could not be created'));
    expect(r.status).toBe(400);
    expect(r.error).toMatch(/Accounts Receivable/);
  });

  it('maps unbalanced journal to 400', () => {
    const r = classifyApiError(new Error('Revenue transaction validation failed: does not balance'));
    expect(r.status).toBe(400);
  });
});
