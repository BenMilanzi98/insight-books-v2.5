import { describe, expect, it } from 'vitest';
import {
  assertParticipationTransition,
  assertBusinessOpsTransition,
  PARTICIPATION_STATUS,
  BUSINESS_OPS_STATUS,
} from '../lib/mraEis/index.js';

describe('Phase 4 EIS state machines', () => {
  it('allows opt-in from not started', () => {
    expect(() =>
      assertParticipationTransition(PARTICIPATION_STATUS.NOT_STARTED, PARTICIPATION_STATUS.OPTED_IN)
    ).not.toThrow();
  });

  it('rejects opt-in from opted out without going through allowed edge', () => {
    // OPTED_OUT → OPTED_IN is allowed
    expect(() =>
      assertParticipationTransition(PARTICIPATION_STATUS.OPTED_OUT, PARTICIPATION_STATUS.OPTED_IN)
    ).not.toThrow();
  });

  it('allows setup in progress from available', () => {
    expect(() =>
      assertBusinessOpsTransition(BUSINESS_OPS_STATUS.AVAILABLE, BUSINESS_OPS_STATUS.SETUP_IN_PROGRESS)
    ).not.toThrow();
  });

  it('rejects jumping to operationally enabled from unavailable', () => {
    expect(() =>
      assertBusinessOpsTransition(BUSINESS_OPS_STATUS.UNAVAILABLE, BUSINESS_OPS_STATUS.OPERATIONALLY_ENABLED)
    ).toThrow();
  });
});
