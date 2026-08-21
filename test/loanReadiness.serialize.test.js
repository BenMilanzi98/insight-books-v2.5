import { describe, it, expect } from 'vitest';
import { serializeLoanReadiness } from '../lib/loanReadiness/application/serialize.js';
import { buildPilotForecast } from '../lib/loanReadiness/application/assessmentService.js';

describe('loan readiness serialize', () => {
  it('converts BigInt to string for JSON', () => {
    const payload = {
      requestedAmountMinor: 50000000n,
      nested: { balloonAmountMinor: 0n },
      list: [1n, 2n],
    };
    const out = serializeLoanReadiness(payload);
    expect(() => JSON.stringify(out)).not.toThrow();
    expect(out.requestedAmountMinor).toBe('50000000');
    expect(out.nested.balloonAmountMinor).toBe('0');
    expect(out.list).toEqual(['1', '2']);
  });
});

describe('pilot forecast', () => {
  it('builds enough periods for the term', () => {
    const f = buildPilotForecast(24, 1000000);
    expect(f.integrityStatus).toBe('VALID');
    expect(f.periods.length).toBeGreaterThanOrEqual(24);
  });
});
