import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildActorContext,
  actorFromSessionUser,
  evaluateAuthorization,
  assertAuthorized,
  evaluateMakerChecker,
  assertMakerChecker,
  computeApprovalPayloadChecksum,
  buildApprovalRequest,
  applyApprovalDecision,
  invalidateIfStale,
  buildAuditEvent,
  redactForAudit,
  verifyAuditChain,
  encodeSessionToken,
  decodeSessionToken,
  checkRateLimit,
  applyFieldAccess,
  maskBankAccount,
  assertAiActionAllowed,
  minimizeAiPromptPayload,
  validateAiOutputClaims,
  verifyWebhookSignature,
  assertSafeUpload,
  sanitizeSpreadsheetCell,
  businessCacheKey,
  SelfApprovalNotAllowedError,
  PermissionDeniedError,
  CrossTenantAccessError,
  AiGovernanceBlockedError,
  WebhookSignatureError,
  FileSecurityError,
  ApprovalChecksumMismatchError,
} from '../lib/securityGovernance/index.js';
import { createHmac } from 'crypto';
import { _resetWebhookNonces } from '../lib/securityGovernance/domain/webhookSecurity.js';
import { _resetRateLimits as resetRl } from '../lib/securityGovernance/domain/rateLimit.js';

describe('actor context', () => {
  it('builds frozen actor with business scope', () => {
    const actor = buildActorContext({
      userId: 'u1',
      businessId: 'b1',
      roles: ['Finance Manager'],
      permissions: ['journal.view', 'journal.approve'],
    });
    expect(actor.businessId).toBe('b1');
    expect(actor.effectiveUserId).toBe('u1');
    expect(Object.isFrozen(actor)).toBe(true);
  });

  it('flattens nested permissions from session user', () => {
    const actor = actorFromSessionUser({
      id: 'u1',
      tenantId: 'b1',
      role: { name: 'Clerk', permissions: { journalEntries: { view: true, post: false } } },
    });
    expect(actor.permissions).toContain('journalEntries.view');
    expect(actor.permissions).not.toContain('journalEntries.post');
  });
});

describe('authorization engine', () => {
  const actor = buildActorContext({
    userId: 'u1',
    businessId: 'b1',
    permissions: ['journal.view'],
    roles: ['Clerk'],
  });

  it('allows matching permission in same business', () => {
    const r = evaluateAuthorization({
      actor,
      permission: 'journal.view',
      resourceBusinessId: 'b1',
    });
    expect(r.decision).toBe('ALLOW');
  });

  it('denies cross-business access', () => {
    const r = evaluateAuthorization({
      actor,
      permission: 'journal.view',
      resourceBusinessId: 'b2',
    });
    expect(r.decision).toBe('DENY');
    expect(r.code).toBe('CROSS_BUSINESS');
    expect(() => assertAuthorized(r)).toThrow(CrossTenantAccessError);
  });

  it('denies missing permission', () => {
    expect(() =>
      assertAuthorized(
        evaluateAuthorization({ actor, permission: 'journal.post', resourceBusinessId: 'b1' })
      )
    ).toThrow(PermissionDeniedError);
  });
});

describe('segregation of duties', () => {
  it('blocks self-approval', () => {
    expect(() =>
      assertMakerChecker({ creatorId: 'u1', approverId: 'u1', selfApprovalAllowed: false })
    ).toThrow(SelfApprovalNotAllowedError);
    expect(evaluateMakerChecker({ creatorId: 'u1', approverId: 'u2' }).conflict).toBe(false);
  });
});

describe('approval engine', () => {
  it('invalidates stale approvals on payload change', () => {
    const payload = { amount: '1000.00', accountId: 'a1' };
    const req = buildApprovalRequest({
      businessId: 'b1',
      policyVersion: { status: 'PUBLISHED', version: 1, selfApprovalAllowed: false, minimumApprovers: 1 },
      sourceModule: 'expenses',
      sourceType: 'Expense',
      sourceId: 'e1',
      action: 'approve',
      amountMinor: 100000,
      currency: 'MWK',
      requestedBy: 'u1',
      payload,
    });
    const stale = invalidateIfStale(req, { ...payload, amount: '2000.00' });
    expect(stale.status).toBe('INVALIDATED');
  });

  it('blocks self-approve decision and detects checksum mismatch', () => {
    const payload = { amount: '1000.00' };
    const req = buildApprovalRequest({
      businessId: 'b1',
      policyVersion: { status: 'PUBLISHED', version: 1, selfApprovalAllowed: false, minimumApprovers: 1 },
      sourceModule: 'expenses',
      sourceType: 'Expense',
      sourceId: 'e1',
      action: 'approve',
      amountMinor: 100000,
      currency: 'MWK',
      requestedBy: 'u1',
      payload,
    });
    expect(() =>
      applyApprovalDecision(req, {
        decision: 'APPROVE',
        approverId: 'u1',
        currentPayloadChecksum: req.payloadChecksum,
      })
    ).toThrow(SelfApprovalNotAllowedError);

    expect(() =>
      applyApprovalDecision(req, {
        decision: 'APPROVE',
        approverId: 'u2',
        currentPayloadChecksum: computeApprovalPayloadChecksum({ amount: '999' }),
      })
    ).toThrow(ApprovalChecksumMismatchError);

    const ok = applyApprovalDecision(req, {
      decision: 'APPROVE',
      approverId: 'u2',
      currentPayloadChecksum: req.payloadChecksum,
    });
    expect(ok.request.status).toBe('APPROVED');
    expect(ok.decision.immutable).toBe(true);
  });
});

describe('audit events', () => {
  it('redacts secrets and verifies hash chain', () => {
    const redacted = redactForAudit({ password: 'x', note: 'ok', token: 'abc' });
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.note).toBe('ok');

    const e1 = buildAuditEvent({
      eventType: 'LOGIN_SUCCEEDED',
      businessId: 'b1',
      actor: { actorId: 'u1', actorType: 'USER' },
      outcome: 'SUCCESS',
    });
    const e2 = buildAuditEvent({
      eventType: 'ACCESS_DENIED',
      businessId: 'b1',
      actor: { actorId: 'u1', actorType: 'USER' },
      outcome: 'FAILURE',
      previousHash: e1.integrityHash,
    });
    const chain = verifyAuditChain([e1, e2]);
    expect(chain.valid).toBe(true);
  });
});

describe('session tokens', () => {
  it('round-trips payload (signed when secret present)', () => {
    const prev = process.env.SESSION_SIGNING_SECRET;
    process.env.SESSION_SIGNING_SECRET = 'test-secret-phase15';
    const token = encodeSessionToken({ userId: 'u1', tenantId: 'b1', role: 'Admin' });
    expect(token.startsWith('v2.')).toBe(true);
    const decoded = decodeSessionToken(token);
    expect(decoded.userId).toBe('u1');
    expect(decoded._signed).toBe(true);
    process.env.SESSION_SIGNING_SECRET = prev;
  });
});

describe('rate limit', () => {
  beforeEach(() => {
    resetRl();
  });
  it('blocks after limit', () => {
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit('t', { limit: 3, windowMs: 60_000 }).allowed).toBe(true);
    }
    expect(checkRateLimit('t', { limit: 3, windowMs: 60_000 }).allowed).toBe(false);
  });
});

describe('field security', () => {
  it('masks bank accounts server-side', () => {
    expect(maskBankAccount('1234567890')).toMatch(/\*+7890$/);
    const masked = applyFieldAccess(
      { bankAccountNumber: '1234567890', name: 'A' },
      { bankAccountNumber: 'RESTRICTED_BANKING' },
      { bankAccountNumber: 'MASKED' }
    );
    expect(masked.bankAccountNumber).not.toBe('1234567890');
  });
});

describe('AI governance', () => {
  it('blocks privileged AI actions and minimizes sensitive prompt data', () => {
    const actor = buildActorContext({
      userId: 'u1',
      businessId: 'b1',
      permissions: ['financialPlanning.runAISuggestions'],
    });
    expect(() => assertAiActionAllowed(actor, 'journal.post')).toThrow(AiGovernanceBlockedError);
    const minimized = minimizeAiPromptPayload({
      summary: 'ok',
      password: 'secret',
      bankStatement: 'full dump',
    });
    expect(minimized.data.password).toBe('[REDACTED_REFERENCE_ONLY]');
    expect(minimized.governance.canApprove).toBe(false);
    expect(validateAiOutputClaims({ actions: ['journal.post'] }).valid).toBe(false);
  });
});

describe('webhook + file security', () => {
  beforeEach(() => {
    _resetWebhookNonces();
  });

  it('verifies signature and rejects replay', () => {
    const secret = 'whsec';
    const body = '{"ok":true}';
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
    expect(
      verifyWebhookSignature({
        rawBody: body,
        signatureHeader: `sha256=${sig}`,
        secret,
        timestampHeader: ts,
        nonce: 'n1',
      }).ok
    ).toBe(true);
    expect(() =>
      verifyWebhookSignature({
        rawBody: body,
        signatureHeader: `sha256=${sig}`,
        secret,
        timestampHeader: ts,
        nonce: 'n1',
      })
    ).toThrow();
    expect(() =>
      verifyWebhookSignature({
        rawBody: body,
        signatureHeader: 'sha256=deadbeef',
        secret,
        timestampHeader: ts,
      })
    ).toThrow(WebhookSignatureError);
  });

  it('rejects dangerous uploads and neutralizes formulas', () => {
    expect(() => assertSafeUpload({ filename: 'evil.exe', sizeBytes: 10 })).toThrow(
      FileSecurityError
    );
    expect(assertSafeUpload({ filename: 'stmt.csv', sizeBytes: 100 }).ext).toBe('csv');
    expect(sanitizeSpreadsheetCell('=cmd|')).toMatch(/^'/);
  });
});

describe('cache keys', () => {
  it('requires businessId', () => {
    expect(() => businessCacheKey({ resource: 'ledger' })).toThrow(/businessId/);
    expect(businessCacheKey({ businessId: 'b1', resource: 'ledger' })).toContain('b:b1');
  });
});
