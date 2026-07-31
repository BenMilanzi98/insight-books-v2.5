import { describe, it, expect } from 'vitest';
import {
  formatMetricValue,
  METRIC_STATUS,
  unavailableMetric,
} from '@/lib/admin/intelligence';

describe('formatMetricValue', () => {
  it('returns null for unavailable envelopes (never zero)', () => {
    const m = unavailableMetric('engagement.dau', 'not instrumented');
    expect(m.value).toBeNull();
    expect(formatMetricValue(m)).toBeNull();
  });

  it('formats money and respects masked', () => {
    expect(
      formatMetricValue({
        status: METRIC_STATUS.READY,
        value: 1200,
        unit: 'money',
        currency: 'MWK',
      })
    ).toContain('1,200');
    expect(
      formatMetricValue({
        status: METRIC_STATUS.READY_WITH_LIMITATIONS,
        value: 1200,
        unit: 'money',
        currency: 'MWK',
        masked: true,
      })
    ).toBe('••••');
  });
});
