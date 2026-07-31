import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';
import { verifyAdminJwtEdge } from '@/lib/admin/authorization/verifyAdminJwtEdge';

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signHs256(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${sig}`;
}

describe('verifyAdminJwtEdge', () => {
  const secret = 'insightbooks-local-dev-only-jwt-secret-min-32-chars';
  let prevJwt;
  let prevSession;

  beforeEach(() => {
    prevJwt = process.env.JWT_SECRET;
    prevSession = process.env.SESSION_SECRET;
    delete process.env.JWT_SECRET;
    delete process.env.SESSION_SECRET;
  });

  afterEach(() => {
    if (prevJwt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevJwt;
    if (prevSession === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSession;
  });

  it('accepts a valid admin token', async () => {
    const token = signHs256(
      { adminId: 'a1', isAdmin: true, exp: Math.floor(Date.now() / 1000) + 3600 },
      secret
    );
    const result = await verifyAdminJwtEdge(token);
    expect(result.ok).toBe(true);
    expect(result.payload.adminId).toBe('a1');
  });

  it('rejects forged signature', async () => {
    const token = signHs256(
      { adminId: 'a1', isAdmin: true, exp: Math.floor(Date.now() / 1000) + 3600 },
      'wrong-secret-value-here!!'
    );
    const result = await verifyAdminJwtEdge(token);
    expect(result.ok).toBe(false);
  });

  it('rejects expired token', async () => {
    const token = signHs256(
      { adminId: 'a1', isAdmin: true, exp: Math.floor(Date.now() / 1000) - 10 },
      secret
    );
    const result = await verifyAdminJwtEdge(token);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('expired');
  });
});
