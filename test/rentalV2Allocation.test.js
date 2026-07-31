import { describe, expect, it } from 'vitest';
import { rangesOverlap } from '../lib/rentalV2/allocation.js';

describe('rentalV2 allocation overlap', () => {
  it('detects overlapping windows', () => {
    expect(
      rangesOverlap('2026-07-01T00:00:00Z', '2026-07-05T00:00:00Z', '2026-07-04T00:00:00Z', '2026-07-10T00:00:00Z')
    ).toBe(true);
  });

  it('allows adjacent non-overlapping windows', () => {
    expect(
      rangesOverlap('2026-07-01T00:00:00Z', '2026-07-05T00:00:00Z', '2026-07-05T00:00:00Z', '2026-07-10T00:00:00Z')
    ).toBe(false);
  });

  it('detects containment', () => {
    expect(
      rangesOverlap('2026-07-01T00:00:00Z', '2026-07-10T00:00:00Z', '2026-07-03T00:00:00Z', '2026-07-04T00:00:00Z')
    ).toBe(true);
  });
});
