import { describe, it, expect } from 'vitest';
import {
  parseInclusiveApiYmdRange,
  formatYmdInTimeZone,
  DEFAULT_REPORT_TIMEZONE,
} from '../lib/dateUtils.js';

describe('parseInclusiveApiYmdRange', () => {
  it('single YMD is full Africa/Blantyre civil day; end formats to same calendar day', () => {
    const { start, end } = parseInclusiveApiYmdRange('2024-04-24', '2024-04-24');
    expect(start.toISOString()).toBe('2024-04-23T22:00:00.000Z');
    expect(end.toISOString()).toBe('2024-04-24T21:59:59.999Z');
    expect(formatYmdInTimeZone(start, DEFAULT_REPORT_TIMEZONE)).toBe('2024-04-24');
    expect(formatYmdInTimeZone(end, DEFAULT_REPORT_TIMEZONE)).toBe('2024-04-24');
  });

  it('inclusive multi-day range ends on last civil day in report TZ', () => {
    const { start, end } = parseInclusiveApiYmdRange('2024-04-23', '2024-04-24');
    expect(formatYmdInTimeZone(start, DEFAULT_REPORT_TIMEZONE)).toBe('2024-04-23');
    expect(formatYmdInTimeZone(end, DEFAULT_REPORT_TIMEZONE)).toBe('2024-04-24');
    expect(start.getTime()).toBeLessThan(end.getTime());
  });
});
