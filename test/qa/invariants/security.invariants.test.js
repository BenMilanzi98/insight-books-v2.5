/**
 * SEC-INV-* executable catalogue (core set).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateAuthorization,
  assertAuthorized,
  assertMakerChecker,
  SelfApprovalNotAllowedError,
  CrossTenantAccessError,
  PermissionDeniedError,
  computeApprovalPayloadChecksum,
  buildApprovalRequest,
  applyApprovalDecision,
  invalidateIfStale,
  ApprovalChecksumMismatchError,
  redactForAudit,
  buildAuditEvent,
  verifyAuditChain,
  updateAuditEvent,
  deleteAuditEvent,
  assertAiActionAllowed,
  AiGovernanceBlockedError,
  verifyWebhookSignature,
  WebhookSignatureError,
  businessCacheKey,
  encodeSessionToken,
  decodeSessionToken,
} from '../../../lib/securityGovernance/index.js';
import { createHmac } from 'crypto';
import { _resetWebhookNonces } from '../../../lib/securityGovernance/domain/webhookSecurity.js';
import { buildActor, buildOtherBusinessActor } from '../factories/actorFactory.js';
import { businessId, userId, resetIdSequence } from '../factories/ids.js';

beforeEach(() => {
  resetIdSequence(0);
  _resetWebhookNonces();
});

describe('SEC-INV-001/003/006 Cross-business and authz', () => {
  it('denies cross-business resource access', () => {
    const actor = buildActor({ business: businessId(1), permissions: ['journal.view'] });
    const r = evaluateAuthorization({
      actor,
      permission: 'journal.view',
      resourceBusinessId: businessId(2),
    });
    expect(r.code).toBe('CROSS_BUSINESS');
    expect(() => assertAuthorized(r)).toThrow(CrossTenantAccessError);
  });

  it('denies missing permission even in same business', () => {
    const actor = buildActor({ permissions: ['journal.view'] });
    expect(() =>
      assertAuthorized(
        evaluateAuthorization({
          actor,
          permission: 'journal.post',
          resourceBusinessId: businessId(1),
        })
      )
    ).toThrow(PermissionDeniedError);
  });

  it('other-business actor cannot use Business A id', () => {
    const actor = buildOtherBusinessActor();
    const r = evaluateAuthorization({
      actor,
      permission: 'journal.view',
      resourceBusinessId: businessId(1),
    });
    expect(r.decision).toBe('DENY');
  });
});

describe('SEC-INV-017 Self-approval denied', () => {
  it('blocks creator approving own request', () => {
    expect(() =>
      assertMakerChecker({ creatorId: userId(1), approverId: userId(1) })
    ).toThrow(SelfApprovalNotAllowedError);
  });
});

describe('SEC-INV-018 Stale approvals invalidated', () => {
  it('checksum mismatch / source change invalidates', () => {
    const payload = { amount: '1000000.00', accountId: 'a1' };
    const req = buildApprovalRequest({
      businessId: businessId(1),
      policyVersion: {
        status: 'PUBLISHED',
        version: 1,
        selfApprovalAllowed: false,
        minimumApprovers: 1,
      },
      sourceModule: 'expenses',
      sourceType: 'Expense',
      sourceId: 'e1',
      action: 'approve',
      amountMinor: 100000000,
      currency: 'MWK',
      requestedBy: userId(1),
      payload,
    });
    const stale = invalidateIfStale(req, { ...payload, amount: '2000000.00' });
    expect(stale.status).toBe('INVALIDATED');

    expect(() =>
      applyApprovalDecision(req, {
        decision: 'APPROVE',
        approverId: userId(2),
        currentPayloadChecksum: computeApprovalPayloadChecksum({ amount: 'x' }),
      })
    ).toThrow(ApprovalChecksumMismatchError);
  });
});

describe('SEC-INV-021/022/023/024 Audit immutability and redaction', () => {
  it('blocks update/delete and redacts secrets', () => {
    expect(() => updateAuditEvent()).toThrow(/APPEND_ONLY/);
    expect(() => deleteAuditEvent()).toThrow(/APPEND_ONLY/);
    const red = redactForAudit({ password: 'x', apiKey: 'k', note: 'ok' });
    expect(red.password).toBe('[REDACTED]');
    expect(red.apiKey).toBe('[REDACTED]');
    const e1 = buildAuditEvent({
      eventType: 'LOGIN_SUCCEEDED',
      businessId: businessId(1),
      actor: { actorId: userId(1), actorType: 'USER' },
    });
    const e2 = buildAuditEvent({
      eventType: 'ACCESS_DENIED',
      businessId: businessId(1),
      actor: { actorId: userId(1), actorType: 'USER' },
      previousHash: e1.integrityHash,
    });
    expect(verifyAuditChain([e1, e2]).valid).toBe(true);
  });
});

describe('SEC-INV-025/026 Webhook forgery and replay', () => {
  it('rejects invalid signature and replay', () => {
    const secret = 'test-wh';
    const body = '{"event":"payment"}';
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
    expect(
      verifyWebhookSignature({
        rawBody: body,
        signatureHeader: `sha256=${sig}`,
        secret,
        timestampHeader: ts,
        nonce: 'n-qa-1',
      }).ok
    ).toBe(true);
    expect(() =>
      verifyWebhookSignature({
        rawBody: body,
        signatureHeader: `sha256=${sig}`,
        secret,
        timestampHeader: ts,
        nonce: 'n-qa-1',
      })
    ).toThrow();
    expect(() =>
      verifyWebhookSignature({
        rawBody: body,
        signatureHeader: 'sha256=00',
        secret,
        timestampHeader: ts,
      })
    ).toThrow(WebhookSignatureError);
  });
});

describe('SEC-INV-028 Cache keys tenant-scoped', () => {
  it('requires businessId and includes it in key', () => {
    expect(() => businessCacheKey({ resource: 'gl' })).toThrow(/businessId/);
    expect(businessCacheKey({ businessId: businessId(1), resource: 'gl' })).toContain(
      `b:${businessId(1)}`
    );
  });
});

describe('SEC-INV-029/030/031 AI cannot privilege-escalate', () => {
  it('blocks journal post / approve / permission grant', () => {
    const actor = buildActor({
      permissions: ['financialPlanning.runAISuggestions', 'loanReadiness.runAICommentary'],
    });
    expect(() => assertAiActionAllowed(actor, 'journal.post')).toThrow(AiGovernanceBlockedError);
    expect(() => assertAiActionAllowed(actor, 'journal.approve')).toThrow(AiGovernanceBlockedError);
    expect(() => assertAiActionAllowed(actor, 'permission.grant')).toThrow(
      AiGovernanceBlockedError
    );
  });
});

describe('SEC-INV session signing', () => {
  it('signed sessions round-trip when secret configured', () => {
    const prev = process.env.SESSION_SIGNING_SECRET;
    process.env.SESSION_SIGNING_SECRET = 'phase16-qa-secret';
    const token = encodeSessionToken({
      userId: userId(1),
      tenantId: businessId(1),
      role: 'Clerk',
    });
    expect(token.startsWith('v2.')).toBe(true);
    const decoded = decodeSessionToken(token);
    expect(decoded.userId).toBe(userId(1));
    expect(decoded._signed).toBe(true);
    process.env.SESSION_SIGNING_SECRET = prev;
  });
});
