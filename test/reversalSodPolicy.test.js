import { describe, expect, it } from 'vitest';
import { assertSeparateApprover } from '../lib/reversals/sodPolicy.js';

describe('reversal SoD assertSeparateApprover', () => {
  it('allows same actor when SoD is off', () => {
    expect(() =>
      assertSeparateApprover({
        requireSeparateApprover: false,
        requestedById: 'user-a',
        actorUserId: 'user-a',
      })
    ).not.toThrow();
  });

  it('rejects same actor when SoD is on', () => {
    expect(() =>
      assertSeparateApprover({
        requireSeparateApprover: true,
        requestedById: 'user-a',
        actorUserId: 'user-a',
      })
    ).toThrow(/Segregation of duties/);
  });

  it('allows different actor when SoD is on', () => {
    expect(() =>
      assertSeparateApprover({
        requireSeparateApprover: true,
        requestedById: 'user-a',
        actorUserId: 'user-b',
      })
    ).not.toThrow();
  });

  it('sets SOD_SAME_ACTOR code on same-actor rejection', () => {
    try {
      assertSeparateApprover({
        requireSeparateApprover: true,
        requestedById: '1',
        actorUserId: '1',
      });
      expect.fail('expected throw');
    } catch (err) {
      expect(err.code).toBe('SOD_SAME_ACTOR');
    }
  });
});
