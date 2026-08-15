import { describe, expect, it } from 'vitest';
import { hoursLeft } from '../../lib/desktop/lockCopy.js';
import { LOCK_MS } from '../../lib/desktop/lock.js';

describe('hoursLeft', () => {
  it('returns remaining hours until lock', () => {
    expect(hoursLeft(LOCK_MS, 21)).toBe(3);
  });

  it('does not go below zero', () => {
    expect(hoursLeft(LOCK_MS, 30)).toBe(0);
  });
});
