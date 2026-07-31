import { describe, expect, it } from 'vitest';
import { MraEisDomainEvents, assertSyntheticSafe, syntheticConfigurationCanonical } from '../lib/mraEis/index.js';

describe('Phase 5 domain events & fixtures', () => {
  it('emits typed events without secrets', () => {
    const evt = MraEisDomainEvents.terminalStateChanged({
      tenantId: 't1',
      businessId: 't1',
      aggregateId: 'term1',
      aggregateVersion: 2,
      payload: { from: 'DRAFT', to: 'TAC_REQUIRED' },
    });
    expect(evt.eventType).toBe('MraEisTerminalStateChanged');
    expect(evt.tenantId).toBe('t1');
    expect(JSON.stringify(evt)).not.toMatch(/eyJ/);
  });

  it('synthetic fixtures are secret-safe', () => {
    expect(assertSyntheticSafe(syntheticConfigurationCanonical())).toBe(true);
  });
});
