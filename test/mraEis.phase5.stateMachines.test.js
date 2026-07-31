import { describe, expect, it } from 'vitest';
import {
  transitionTerminal,
  transitionSnapshot,
  transitionTransmission,
  assertOfflineCreationAllowed,
  TERMINAL_STATUS,
  SNAPSHOT_STATUS,
  TRANSMISSION_STATUS,
} from '../lib/mraEis/index.js';

describe('Phase 5 operational state machines', () => {
  it('allows draft → tac required → activation pending', () => {
    expect(() => transitionTerminal(TERMINAL_STATUS.DRAFT, TERMINAL_STATUS.TAC_REQUIRED)).not.toThrow();
    expect(() =>
      transitionTerminal(TERMINAL_STATUS.TAC_REQUIRED, TERMINAL_STATUS.ACTIVATION_REQUEST_PENDING)
    ).not.toThrow();
  });

  it('rejects revoked terminal reactivation', () => {
    expect(() => transitionTerminal(TERMINAL_STATUS.REVOKED, TERMINAL_STATUS.ACTIVE)).toThrow(
      /Invalid transition|Invalid terminal/
    );
  });

  it('rejects blocked → active direct transition', () => {
    expect(() => transitionTerminal(TERMINAL_STATUS.BLOCKED, TERMINAL_STATUS.ACTIVE)).toThrow(
      /Invalid transition|Invalid terminal/
    );
    expect(() =>
      transitionTerminal(TERMINAL_STATUS.BLOCKED, TERMINAL_STATUS.CONFIGURATION_STALE)
    ).not.toThrow();
  });

  it('makes queued snapshot a final status', () => {
    expect(() => transitionSnapshot(SNAPSHOT_STATUS.CREATED, SNAPSHOT_STATUS.QUEUED)).not.toThrow();
    expect(() => transitionSnapshot(SNAPSHOT_STATUS.QUEUED, SNAPSHOT_STATUS.CREATED)).toThrow();
  });

  it('rejects accepted → sending regression', () => {
    expect(() =>
      transitionTransmission(TRANSMISSION_STATUS.ACCEPTED_ONLINE, TRANSMISSION_STATUS.SENDING)
    ).toThrow(/Accepted transmission|Invalid transition/);
  });

  it('rejects unknown outcome ordinary retry', () => {
    expect(() =>
      transitionTransmission(TRANSMISSION_STATUS.UNKNOWN_OUTCOME, TRANSMISSION_STATUS.RETRY_SCHEDULED)
    ).toThrow(/reconciled|Invalid transition/i);
  });

  it('blocks offline creation without certification', () => {
    expect(() => assertOfflineCreationAllowed({ offlineCertified: false })).toThrow(/offline/i);
    expect(() => assertOfflineCreationAllowed({ offlineCertified: true })).not.toThrow();
  });
});
